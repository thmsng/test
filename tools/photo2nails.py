#!/usr/bin/env python3
"""
photo2nails: turn a photo of a press-on nail set into 3D-ready assets for the shop.

    python3 photo2nails.py photo.jpg --out ../nails/images/sets/clown --name "Clown Carnival"

What it does
  1. SEGMENT   U2-Net-P (a small saliency network, ONNX) finds what is "the object" in the photo; a colour test
               against the table removes the clear case; connected components separate the nails and
               a distance-transform split pulls apart nails that touch.
  2. RECTIFY   every nail is rotated so its tip points up, cropped tight, and cut out with a soft alpha edge
               (RGBA PNG). Real size is estimated (the median nail is assumed to be --nail-width-mm wide),
               and the outline is classified (stiletto / almond / coffin / square / oval).
  3. RELIEF    MiDaS-small (monocular depth, ONNX) is run on each nail; its tilt/curvature is removed and it is
               blended with a shading high-pass so bows, bubbles, beads and sculpted gel stand out. The result is
               a height map and a tangent-space normal map per nail, plus a suggested relief height in mm.
  4. MANIFEST  manifest.json lists everything; the shop turns it into 3D nails with real textures,
               a normal map, and actual vertex displacement for the raised parts.

Models (download once; see models/README or the instructions printed if they are missing):
  models/u2netp.onnx       https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
  models/midas_small.onnx  https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx
"""
import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"


# --------------------------------------------------------------------------- models

def load_session(name, url):
    path = MODELS / name
    if not path.exists():
        sys.exit(f"Missing model {path}.\nDownload it with:\n  mkdir -p {MODELS} && curl -L -o {path} {url}")
    opts = ort.SessionOptions()
    opts.log_severity_level = 3
    return ort.InferenceSession(str(path), opts, providers=["CPUExecutionProvider"])


def saliency(sess, bgr):
    """U2-Net-P: 0..1 'how much is this pixel part of the main object'."""
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = cv2.resize(rgb, (320, 320), interpolation=cv2.INTER_AREA)
    x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    out = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    out = (out - out.min()) / (out.max() - out.min() + 1e-8)
    return cv2.resize(out, (w, h), interpolation=cv2.INTER_CUBIC).clip(0, 1)


def depth(sess, bgr):
    """MiDaS-small: relative inverse depth (bigger = closer), resized back to the input size."""
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    x = cv2.resize(rgb, (256, 256), interpolation=cv2.INTER_AREA)
    x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    out = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0]
    return cv2.resize(out, (w, h), interpolation=cv2.INTER_CUBIC)


# --------------------------------------------------------------------------- segmentation

def estimate_background(bgr):
    """Median colour of a thin frame around the image (the table)."""
    h, w = bgr.shape[:2]
    m = max(4, int(0.03 * min(h, w)))
    ring = np.concatenate([bgr[:m].reshape(-1, 3), bgr[-m:].reshape(-1, 3), bgr[:, :m].reshape(-1, 3), bgr[:, -m:].reshape(-1, 3)])
    return np.median(ring, axis=0)


def find_nail_mask(bgr, sal, args):
    """
    The saliency network picks out the whole product (here: the case with its nails), which gives the region of
    interest. Inside it the floor of the tray is the dominant colour, so we fit it (with a lighting gradient) and
    call everything that clearly differs from it, or is colourful, a nail.
    """
    h, w = bgr.shape[:2]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    roi = (sal > 0.5).astype(np.uint8)
    n, cc, st, _ = cv2.connectedComponentsWithStats(roi)
    if n > 1:
        roi = (cc == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    inset = max(5, int(args.roi_inset * math.sqrt(float(roi.sum()))))
    inner = cv2.erode(roi, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * inset + 1, 2 * inset + 1)))
    sel = inner > 0
    # the floor of the tray / table is the dominant, low-chroma colour inside the region of interest
    ab = lab[..., 1:]
    floor_ab = np.median(ab[sel], axis=0)
    floor_L = np.median(lab[..., 0][sel])
    d_ab = np.linalg.norm(ab - floor_ab, axis=2)
    dark = (floor_L - lab[..., 0]) > args.dark_thresh
    diff = d_ab
    cand = (((d_ab > args.chroma_thresh) | dark) & sel).astype(np.uint8)
    cand = cv2.morphologyEx(cand, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    cand = cv2.morphologyEx(cand, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    # fill holes inside each nail (low-contrast interiors)
    cnts, _ = cv2.findContours(cand, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(cand)
    cv2.drawContours(filled, cnts, -1, 1, cv2.FILLED)
    return filled, diff


def split_touching(mask, min_area):
    """Separate nails that touch: distance-transform watershed (flood the valley between the distance peaks)."""
    from skimage.segmentation import watershed
    n, labels = cv2.connectedComponents(mask)
    out = np.zeros_like(labels)
    nxt = 1
    for k in range(1, n):
        comp = (labels == k).astype(np.uint8)
        area = int(comp.sum())
        if area < min_area:
            continue
        dist = cv2.distanceTransform(comp, cv2.DIST_L2, 5)
        dist_s = cv2.GaussianBlur(dist, (0, 0), 3)
        # a nail is convex-ish: a component with several distinct distance peaks is several nails
        peaks = (dist_s > 0.55 * dist_s.max()).astype(np.uint8)
        pn, plab = cv2.connectedComponents(peaks)
        big = [i for i in range(1, pn) if (plab == i).sum() > 0.04 * area]
        if len(big) <= 1 or area < 1.8 * min_area:
            out[comp > 0] = nxt; nxt += 1
            continue
        markers = np.zeros(comp.shape, np.int32)
        for j, i in enumerate(big, 1):
            markers[plab == i] = j
        ws = watershed(-dist_s, markers, mask=comp > 0)
        for j in range(1, len(big) + 1):
            part = ws == j
            if part.sum() >= min_area:
                out[part] = nxt; nxt += 1
    return out, nxt - 1


def valley_cuts(profile, k, smooth=5, spacing_weight=0.6):
    """
    Positions of the k-1 cuts that separate k items in a 1-D occupancy profile: the emptiest valleys, but kept
    roughly evenly spaced (dynamic programming), so a ragged edge of a charm never gets mistaken for a gap.
    """
    from scipy.signal import find_peaks
    from scipy.ndimage import gaussian_filter1d
    if k <= 1: return []
    prof = gaussian_filter1d(profile.astype(np.float32), smooth)
    lo, hi = np.nonzero(profile > 0)[0][[0, -1]]
    span = max(1, hi - lo)
    cand, _ = find_peaks(-prof[lo:hi + 1], distance=max(3, int(0.03 * span)))
    cand = (cand + lo).tolist()
    if len(cand) < k - 1:
        return [int(lo + span * (i + 1) / k) for i in range(k - 1)]
    pmax = float(prof.max()) + 1e-6
    unit = span / k
    exp = [lo + span * (j + 1) / k for j in range(k - 1)]
    INF = 1e18
    cost = [[prof[c] / pmax + spacing_weight * abs(c - exp[j]) / unit for c in cand] for j in range(k - 1)]
    best = [[INF] * len(cand) for _ in range(k - 1)]
    prev = [[-1] * len(cand) for _ in range(k - 1)]
    best[0] = list(cost[0])
    for j in range(1, k - 1):
        for ci, c in enumerate(cand):
            for pi in range(ci):
                if cand[pi] < c - 0.3 * unit and best[j - 1][pi] + cost[j][ci] < best[j][ci]:
                    best[j][ci] = best[j - 1][pi] + cost[j][ci]; prev[j][ci] = pi
    ci = int(np.argmin(best[-1]))
    if best[-1][ci] >= INF:
        return [int(lo + span * (i + 1) / k) for i in range(k - 1)]
    out = []
    for j in range(k - 2, -1, -1):
        out.append(cand[ci]); ci = prev[j][ci]
    return sorted(out)


def grid_split(mask, rows, cols):
    """Split a mask of nails laid out in a rows x cols grid by cutting along the empty gaps. Row-major labels."""
    out = np.zeros(mask.shape, np.int32)
    # stray specks (case edge, reflections) would stretch the profiles and shift every cut: drop them first
    n0, lab0, st0, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8))
    big = max(st0[1:, cv2.CC_STAT_AREA].max() if n0 > 1 else 0, 1)
    mask = np.isin(lab0, [i for i in range(1, n0) if st0[i, cv2.CC_STAT_AREA] > 0.12 * big]).astype(mask.dtype)
    ycuts = valley_cuts(mask.sum(axis=1), rows)
    yb = [0] + ycuts + [mask.shape[0]]
    nxt = 1
    for r in range(rows):
        band = np.zeros_like(mask); band[yb[r]:yb[r + 1]] = mask[yb[r]:yb[r + 1]]
        xcuts = valley_cuts(band.sum(axis=0), cols)
        xb = [0] + xcuts + [mask.shape[1]]
        for c in range(cols):
            cell = np.zeros_like(mask); cell[:, xb[c]:xb[c + 1]] = band[:, xb[c]:xb[c + 1]]
            if cell.sum() > 0:
                # keep the biggest blob plus any fragments that are close to it
                n, lab, st, _ = cv2.connectedComponentsWithStats(cell)
                out[cell > 0] = nxt
            nxt += 1
    return out, rows * cols


def complete_nails(labels, n, args):
    """
    Colour alone misses white/cream/pearl parts of a nail (clown faces, bows, beads), leaving notches or splitting one
    nail into two fragments. A nail is convex, so: merge fragments that clearly form one nail, then replace each
    nail by its convex hull, and settle any overlap between neighbours by whichever nail is nearest.
    """
    from scipy.spatial import cKDTree
    comps = {k: (labels == k).astype(np.uint8) for k in range(1, n + 1)}
    areas = {k: int(m.sum()) for k, m in comps.items()}
    med = float(np.median(list(areas.values())))

    def hull_of(m):
        pts = cv2.findNonZero(m)
        return cv2.convexHull(pts)

    def aspect_of(m):
        (_, _), (rw, rh), _ = cv2.minAreaRect(cv2.findNonZero(m))
        return min(rw, rh) / max(rw, rh, 1e-6)

    def solidity(m):
        hull = hull_of(m)
        return float(m.sum()) / max(cv2.contourArea(hull), 1.0)

    merged = not getattr(args, 'no_auto_merge', False)
    while merged:
        merged = False
        keys = sorted(comps)
        for i in keys:
            for j in keys:
                if j <= i or i not in comps or j not in comps: continue
                di = cv2.dilate(comps[i], cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * args.merge_gap + 1,) * 2))
                if not (di & comps[j]).any(): continue
                u = comps[i] | comps[j]
                small = min(areas[i], areas[j])
                asp = aspect_of(u)
                if (small < 0.85 * med or solidity(u) > 0.9) and 0.28 < asp < 0.86 and u.sum() < 2.6 * med:
                    comps[i] = u; areas[i] = int(u.sum()); del comps[j]; del areas[j]
                    merged = True
    # the caller knows how many nails the set has (usually 10): merge the smallest fragment into the neighbour it touches
    while args.expect and len(comps) > args.expect:
        best = None
        for i in sorted(comps):
            for j in sorted(comps):
                if j <= i: continue
                di = cv2.dilate(comps[i], cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * (args.merge_gap + 40) + 1,) * 2))
                if not (di & comps[j]).any(): continue
                key = min(areas[i], areas[j])
                if best is None or key < best[0]: best = (key, i, j)
        if best is None: break
        _, i, j = best
        comps[i] = comps[i] | comps[j]; areas[i] = int(comps[i].sum()); del comps[j]; del areas[j]
    # drop thin stray bits (squiggles of colour that belong to a neighbour), keep the solid body
    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (args.thin_px, args.thin_px))
    for k in list(comps):
        opened = cv2.morphologyEx(comps[k], cv2.MORPH_OPEN, kern)
        if opened.sum() > 0.35 * comps[k].sum():
            comps[k] = opened
    keys = sorted(comps)
    hull_masks = {}
    for k in keys:
        hm = np.zeros_like(comps[k])
        cv2.fillPoly(hm, [hull_of(comps[k])], 1)
        hull_masks[k] = hm
    # a nail whose hull sits mostly inside another's is part of it (the bow on a charm-covered nail, say)
    changed = True
    while changed:
        changed = False
        for i in sorted(hull_masks):
            for j in sorted(hull_masks):
                if j <= i or i not in hull_masks or j not in hull_masks: continue
                inter = int((hull_masks[i] & hull_masks[j]).sum())
                if inter > 0.6 * min(hull_masks[i].sum(), hull_masks[j].sum()):
                    comps[i] = comps[i] | comps[j]; del comps[j]; del hull_masks[j]
                    hm = np.zeros_like(comps[i]); cv2.fillPoly(hm, [hull_of(comps[i])], 1); hull_masks[i] = hm
                    changed = True
    keys = sorted(comps)
    # overlapping hulls: give the pixel to the nearest original nail
    count = sum(hull_masks[k].astype(np.int32) for k in keys)
    out = np.zeros_like(labels)
    trees = {}
    for k in keys:
        ys, xs = np.nonzero(comps[k])
        step = max(1, len(xs) // 4000)
        trees[k] = cKDTree(np.stack([xs[::step], ys[::step]], 1))
    cy, cx = np.nonzero(count > 1)
    if len(cx):
        pts = np.stack([cx, cy], 1)
        dists = np.stack([trees[k].query(pts)[0] for k in keys], 1)
        win = np.argmin(dists, 1)
        for ki, k in enumerate(keys):
            sel = win == ki
            allowed = hull_masks[k][cy[sel], cx[sel]] > 0
            out[cy[sel][allowed], cx[sel][allowed]] = ki + 1
    for ki, k in enumerate(keys):
        solo = (hull_masks[k] > 0) & (count == 1)
        out[solo] = ki + 1
    return out, len(keys)


# --------------------------------------------------------------------------- per-nail processing

def classify_shape(widths, length):
    """Shape from the width profile along the nail axis (tip at the end of the list)."""
    w = np.array(widths, np.float32)
    wmax = w.max() + 1e-6
    tip = w[int(0.88 * len(w)):].mean() / wmax      # how wide the last bit is
    mid = w[int(0.7 * len(w))] / wmax
    ratio = length / wmax
    if tip < 0.28 and ratio > 1.7:
        return "stiletto"
    if tip < 0.5:
        return "almond" if mid > 0.7 else "stiletto"
    if tip < 0.82:
        return "coffin" if ratio > 1.45 else "oval"
    return "square" if ratio < 1.5 else "oval"


def rectify_nail(bgr, lab_mask, label, pad=6):
    """Rotate so the nail's long axis is vertical with the tip up; crop tight. Returns crop, mask, info."""
    comp = (lab_mask == label).astype(np.uint8)
    cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cnt = max(cnts, key=cv2.contourArea)
    (cx, cy), (rw, rh), ang = cv2.minAreaRect(cnt)
    if rw > rh:                      # make the first side the short one
        ang += 90
        rw, rh = rh, rw
    # rotate so the long axis is vertical
    rot = cv2.getRotationMatrix2D((cx, cy), ang, 1.0)
    h, w = comp.shape
    big = int(math.hypot(h, w))
    rot[0, 2] += big / 2 - cx; rot[1, 2] += big / 2 - cy
    img_r = cv2.warpAffine(bgr, rot, (big, big), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    msk_r = cv2.warpAffine(comp, rot, (big, big), flags=cv2.INTER_NEAREST)
    ys, xs = np.nonzero(msk_r)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # which end is the tip? the narrower one
    prof = msk_r[y0:y1, x0:x1].sum(axis=1).astype(np.float32)
    k = max(2, len(prof) // 5)
    if prof[:k].mean() > prof[-k:].mean():   # wide end at the top -> flip so the tip is up
        img_r = cv2.rotate(img_r, cv2.ROTATE_180); msk_r = cv2.rotate(msk_r, cv2.ROTATE_180)
        ys, xs = np.nonzero(msk_r)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(big, y1 + pad), min(big, x1 + pad)
    crop = img_r[y0:y1, x0:x1].copy()
    m = msk_r[y0:y1, x0:x1].copy()
    return crop, m


def tight_box(m):
    ys, xs = np.nonzero(m)
    return xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def smooth_alpha(m):
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.1)
    return np.clip((a - 0.5) * 2.4 + 0.5, 0, 1)


def relief_maps(crop, m, depth_sess, args):
    """Height 0..1 inside the nail (raised parts bright) and the tangent-space normal map."""
    h, w = m.shape
    inner = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    # --- depth from the network on a padded square crop
    side = max(h, w)
    sq = np.full((side, side, 3), crop.reshape(-1, 3)[m.reshape(-1) > 0].mean(axis=0), np.uint8)
    oy, ox = (side - h) // 2, (side - w) // 2
    sq[oy:oy + h, ox:ox + w] = crop
    sel = inner > 0
    shade_w = args.shade_weight
    if depth_sess is not None:
        d = depth(depth_sess, sq)[oy:oy + h, ox:ox + w]
        # remove tilt and curvature of the nail itself: fit a quadratic surface over the mask, keep the residual
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        xn, yn = (xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)
        A = np.stack([np.ones_like(xn), xn, yn, xn * xn, yn * yn, xn * yn], -1)
        coef, *_ = np.linalg.lstsq(A[sel], d[sel], rcond=None)
        res = d - (A.reshape(-1, 6) @ coef).reshape(h, w)
        res = cv2.GaussianBlur(res, (0, 0), 1.2)
    else:
        res, shade_w = np.zeros((h, w), np.float32), 1.0
    # --- shading cue: highlights and local brightness bumps (bows, bubbles, beads, gel)
    L = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32)
    base = cv2.GaussianBlur(L, (0, 0), max(3, 0.12 * min(h, w)))
    hp = cv2.GaussianBlur(L - base, (0, 0), 1.0)
    def norm(a):
        v = a[sel]
        lo, hi = np.percentile(v, 5), np.percentile(v, 99)
        return np.clip((a - lo) / (hi - lo + 1e-6), 0, 1)
    height = (1 - shade_w) * norm(res) + shade_w * norm(hp)
    # only what clearly stands proud counts; flat nail stays flat
    height = np.clip((height - args.relief_floor) / (1 - args.relief_floor), 0, 1) ** 1.2
    # fall off toward the nail edge so the relief never pokes past the outline
    dist = cv2.distanceTransform(m, cv2.DIST_L2, 5)
    height *= np.clip(dist / 6.0, 0, 1)
    height = cv2.GaussianBlur(height, (0, 0), 1.0) * (m > 0)
    # --- normal map (OpenGL convention: +Y = up in the image)
    gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    s = args.normal_strength * max(h, w) / 64.0
    nx, ny, nz = -gx * s, gy * s, np.ones_like(gx)
    n = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack([nx / n, ny / n, nz / n], -1)
    return height, ((normal * 0.5 + 0.5) * 255).astype(np.uint8)


def hex_color(bgr, m):
    px = bgr[m > 0]
    b, g, r = np.median(px, axis=0).astype(int)
    return f"#{r:02x}{g:02x}{b:02x}"


# --------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo")
    ap.add_argument("--out", required=True, help="output folder (e.g. ../nails/images/sets/my-set)")
    ap.add_argument("--name", default=None)
    ap.add_argument("--nail-width-mm", type=float, default=13.0, help="width of the median nail, used to set real scale")
    ap.add_argument("--mm-per-px", type=float, default=None, help="if you know the photo scale, give it instead")
    ap.add_argument("--max-side", type=int, default=2000)
    ap.add_argument("--roi-inset", type=float, default=0.045, help="ignore this much of the case edge (fraction of its size)")
    ap.add_argument("--layout", default=None, help="how the nails are laid out in the photo, as ROWSxCOLS (e.g. 2x5); the most reliable option")
    ap.add_argument("--expect", type=int, default=None, help="number of nails in the set (e.g. 10): fragments are merged until this many remain")
    ap.add_argument("--merge-gap", type=int, default=22, help="fragments closer than this (px) may be merged into one nail")
    ap.add_argument("--thin-px", type=int, default=21, help="features thinner than this are not part of a nail body")
    ap.add_argument("--dark-thresh", type=float, default=42.0, help="how much darker than the floor counts as nail (black nails)")
    ap.add_argument("--color-thresh", type=float, default=15.0)
    ap.add_argument("--chroma-thresh", type=float, default=9.0, help="colour distance from the floor that counts as nail")
    ap.add_argument("--min-area", type=float, default=0.0025, help="smallest nail, as a fraction of the image area")
    ap.add_argument("--relief-floor", type=float, default=0.28)
    ap.add_argument("--shade-weight", type=float, default=0.45)
    ap.add_argument("--normal-strength", type=float, default=2.2)
    ap.add_argument("--relief-mm", type=float, default=2.6, help="height of the tallest raised detail, in mm")
    ap.add_argument("--tex-height", type=int, default=640, help="longest side of each output nail texture")
    ap.add_argument("--no-depth", action="store_true", help="skip the depth network (shading-only relief)")
    args = ap.parse_args()

    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    pil = ImageOps.exif_transpose(Image.open(args.photo)).convert("RGB")
    scale = min(1.0, args.max_side / max(pil.size))
    if scale < 1: pil = pil.resize((round(pil.width * scale), round(pil.height * scale)), Image.LANCZOS)
    bgr = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    H, W = bgr.shape[:2]
    print(f"photo {args.photo}: {W}x{H}")

    u2 = load_session("u2netp.onnx", "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx")
    midas = None if args.no_depth else load_session("midas_small.onnx", "https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx")

    # 1 segment
    sal = saliency(u2, bgr)
    cand, diff = find_nail_mask(bgr, sal, args)
    if args.layout:
        rows_, cols_ = (int(v) for v in args.layout.lower().split("x"))
        labels, n = grid_split(cand, rows_, cols_)
        args.expect, args.no_auto_merge = None, True
    else:
        labels, n = split_touching(cand, int(args.min_area * W * H))
    labels, n = complete_nails(labels, n, args)
    print(f"found {n} nails")
    if n == 0:
        sys.exit("No nails found. Try --sal-thresh 0.15, lower --color-thresh, or a photo with a plainer background.")

    # order: rows top to bottom, left to right inside a row
    props = []
    for k in range(1, n + 1):
        ys, xs = np.nonzero(labels == k)
        props.append((k, xs.mean(), ys.mean(), len(xs)))
    ys_sorted = sorted(props, key=lambda p: p[2])
    row_gap = np.median([p[2] for p in props]) * 0.0 + 0.5 * np.sqrt(np.median([p[3] for p in props])) * 2
    rows, cur = [], [ys_sorted[0]]
    for p in ys_sorted[1:]:
        if p[2] - np.mean([q[2] for q in cur]) > row_gap * 0.9: rows.append(cur); cur = [p]
        else: cur.append(p)
    rows.append(cur)
    order = []
    for ri, r in enumerate(rows):
        for ci, p in enumerate(sorted(r, key=lambda p: p[1])): order.append((p[0], ri, ci))

    # 2 + 3 per nail
    items = []
    for idx, (label, ri, ci) in enumerate(order, 1):
        crop, m = rectify_nail(bgr, labels, label)
        x0, x1, y0, y1 = tight_box(m)
        crop, m = crop[y0:y1, x0:x1], m[y0:y1, x0:x1]
        h, w = m.shape
        # width profile along the axis (cuticle at the bottom, tip at the top)
        prof = m.sum(axis=1).astype(np.float32)[::-1]
        shape = classify_shape(prof.tolist(), h)
        height, normal = relief_maps(crop, m, midas, args)
        items.append(dict(idx=idx, row=ri, col=ci, crop=crop, mask=m, shape=shape, w=w, h=h, height=height, normal=normal))
        print(f"  nail {idx:02d}: {w}x{h}px  {shape}")

    # real size
    widths_px = np.array([it["w"] for it in items], np.float32)
    mm_per_px = args.mm_per_px or (args.nail_width_mm / float(np.median(widths_px)))
    # downscale factor for the output textures
    mf = max(it["h"] for it in items)
    tex_scale = min(1.0, args.tex_height / mf)

    manifest = dict(name=args.name or out.name, source=os.path.basename(args.photo), mmPerPx=round(float(mm_per_px), 5),
                    texScale=round(float(tex_scale), 4), nails=[])
    overview = []
    for it in items:
        i = it["idx"]
        crop, m, height, normal = it["crop"], it["mask"], it["height"], it["normal"]
        a = smooth_alpha(m)
        tw, th = max(8, round(it["w"] * tex_scale)), max(8, round(it["h"] * tex_scale))
        rgba = np.dstack([cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), (a * 255).astype(np.uint8)])
        rgba = cv2.resize(rgba, (tw, th), interpolation=cv2.INTER_AREA)
        Image.fromarray(rgba, "RGBA").save(out / f"nail-{i:02d}.png")
        files = dict(color=f"nail-{i:02d}.png")
        relief_mm = 0.0
        if height is not None:
            hmap = cv2.resize(height, (tw, th), interpolation=cv2.INTER_AREA)
            nmap = cv2.resize(normal, (tw, th), interpolation=cv2.INTER_AREA)
            Image.fromarray((hmap * 255).astype(np.uint8), "L").save(out / f"nail-{i:02d}-height.png")
            Image.fromarray(nmap, "RGB").save(out / f"nail-{i:02d}-normal.png")
            files.update(height=f"nail-{i:02d}-height.png", normal=f"nail-{i:02d}-normal.png")
            relief_mm = round(float(args.relief_mm * np.percentile(height[m > 0], 99.5)), 2)
        manifest["nails"].append(dict(
            id=i, row=it["row"], col=it["col"], widthMm=round(it["w"] * mm_per_px, 2), lengthMm=round(it["h"] * mm_per_px, 2),
            shape=it["shape"], reliefMm=relief_mm, meanColor=hex_color(crop, m), **files))
        tile = rgba[..., :3].copy()
        tile[rgba[..., 3] < 128] = (240, 236, 232)
        overview.append(tile)

    # suggested hands: nails come in size pairs, so deal them out by width: each hand gets one of every size tier
    by_w = sorted(manifest["nails"], key=lambda n: -n["widthMm"])
    for rank, n in enumerate(by_w):
        n["hand"] = "AB"[rank % 2]
        n["finger"] = ["thumb", "index", "middle", "ring", "pinky"][min(rank // 2, 4)]
    with open(out / "manifest.json", "w") as f: json.dump(manifest, f, indent=2)

    # contact sheet + detection debug
    cell = 360
    sheet = np.full((2 * cell, 5 * cell if len(overview) > 5 else len(overview) * cell, 3), 236, np.uint8)
    for j, t in enumerate(overview[:10]):
        s = min((cell - 16) / t.shape[0], (cell - 16) / t.shape[1])
        t2 = cv2.resize(t, (max(1, int(t.shape[1] * s)), max(1, int(t.shape[0] * s))), interpolation=cv2.INTER_AREA)
        r, c = divmod(j, 5)
        sheet[r * cell + 8:r * cell + 8 + t2.shape[0], c * cell + 8:c * cell + 8 + t2.shape[1]] = t2[:, :, ::-1]
    cv2.imwrite(str(out / "overview.jpg"), sheet)
    dbg = bgr.copy()
    for label, ri, ci in order:
        cnts, _ = cv2.findContours((labels == label).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(dbg, cnts, -1, (60, 220, 60), 3)
        x, y, ww, hh = cv2.boundingRect(max(cnts, key=cv2.contourArea))
        idx = [o[0] for o in order].index(label) + 1
        cv2.putText(dbg, str(idx), (x + 6, y + 36), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
    cv2.imwrite(str(out / "detected.jpg"), dbg)
    print(f"wrote {len(items)} nails to {out} (scale {mm_per_px:.4f} mm/px)")


if __name__ == "__main__":
    main()
