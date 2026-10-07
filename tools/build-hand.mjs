/**
 * Builds the hand models used by the nail shop:
 *   - "try":   a relaxed, half-folded right hand (back of the hand up, fingers curled halfway)
 *   - "point": a pointing hand (index finger extended, the rest in a loose fist) used as the cursor
 *
 * Each hand is a signed-distance field (tapered capsules for every bone, ellipsoids for the palm,
 * thenar and hypothenar pads, smooth-unioned so the webbing between fingers forms naturally),
 * polygonised with surface nets, and baked into a binary glTF with smooth normals and
 * ambient-occlusion vertex colours. The fingernail frames are exported so the page can fit
 * press-on nail shells exactly to the finger surface.
 *
 *   node build-hand.mjs ../nails/assets/hands.glb
 */
import fs from 'node:fs';

const OUT = process.argv[2] || '../nails/assets/hands.glb';
const H = +(process.env.RES || 0.0016); // grid resolution (m)

/* ------------------------------------------------------------------ */
/*  SDF primitives                                                     */
/* ------------------------------------------------------------------ */

const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

/** tapered capsule (round cone) between a (radius r1) and b (radius r2) */
function roundCone(px, py, pz, a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const dx = pax * l2 - bax * y, dy = pay * l2 - bay * y, dz = paz * l2 - baz * y;
  const x2 = dx * dx + dy * dy + dz * dz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function ellipsoid(px, py, pz, c, r) {
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = Math.hypot(x, y, z);
  const x1 = x / r[0], y1 = y / r[1], z1 = z / r[2];
  const k1 = Math.hypot(x1, y1, z1);
  return k1 < 1e-9 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
}
function roundBox(px, py, pz, c, b, r) {
  const qx = Math.abs(px - c[0]) - b[0] + r, qy = Math.abs(py - c[1]) - b[1] + r, qz = Math.abs(pz - c[2]) - b[2] + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/* ------------------------------------------------------------------ */
/*  hand definition                                                    */
/* ------------------------------------------------------------------ */

const rad = (d) => (d * Math.PI) / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// fingers: knuckle position, bone lengths [proximal, middle, distal], radii at [MCP, PIP, DIP, tip]
const FINGERS = {
  index: { mcp: [0.0295, 0.0, -0.002], len: [0.039, 0.022, 0.0195], r: [0.0092, 0.0080, 0.0072, 0.0064], yaw: 5 },
  middle: { mcp: [0.0100, 0.0, 0.000], len: [0.043, 0.026, 0.0215], r: [0.0095, 0.0083, 0.0074, 0.0066], yaw: 1 },
  ring: { mcp: [-0.0105, 0.0, -0.004], len: [0.040, 0.0245, 0.0205], r: [0.0088, 0.0077, 0.0069, 0.0061], yaw: -3 },
  pinky: { mcp: [-0.0305, 0.0, -0.012], len: [0.031, 0.0175, 0.0175], r: [0.0080, 0.0069, 0.0061, 0.0054], yaw: -9 },
};

const POSES = {
  // back of hand up, fingers half curled (viewed from the fingertip side the nails face you)
  try: {
    flex: { index: [24, 40, 18], middle: [27, 44, 20], ring: [31, 46, 20], pinky: [36, 50, 22] },
    thumb: { cmc: [0.030, -0.012, -0.050], dirs: [[0.50, -0.06, 0.86], [0.62, -0.20, 0.76], [0.55, -0.30, 0.78]] },
    forearm: 0.16, res: 0.0014,
  },
  point: {
    flex: { index: [4, 6, 4], middle: [88, 100, 50], ring: [92, 100, 50], pinky: [94, 98, 48] },
    thumb: { cmc: [0.030, -0.012, -0.050], dirs: [[0.50, -0.10, 0.86], [0.30, -0.55, 0.78], [-0.10, -0.60, 0.80]] },
    forearm: 0.30, res: 0.0021,
  },
};

/** capsule with an elliptical cross-section (flatter front-to-back than side-to-side) */
function ellCone(px, py, pz, c) {
  const rx = px - c.a[0], ry = py - c.a[1], rz = pz - c.a[2];
  const t = rx * c.d[0] + ry * c.d[1] + rz * c.d[2];
  const v = rx * c.u[0] + ry * c.u[1] + rz * c.u[2];
  const w = rx * c.s[0] + ry * c.s[1] + rz * c.s[2];
  const vy = v / c.ky;
  const qx = c.a[0] + c.d[0] * t + c.u[0] * vy + c.s[0] * w;
  const qy = c.a[1] + c.d[1] * t + c.u[1] * vy + c.s[1] * w;
  const qz = c.a[2] + c.d[2] * t + c.u[2] * vy + c.s[2] * w;
  return roundCone(qx, qy, qz, c.a, c.b, c.r1, c.r2) * c.ky;
}
function bone(a, b, r1, r2, up, ky = 0.88, soft = 0.006) {
  const d = norm(sub(b, a));
  let u = sub(up, scale(d, dot(up, d))); u = norm(u);
  return { a, b, r1, r2, d, u, s: cross(d, u), ky, soft };
}

function buildHandDef(pose) {
  const P = POSES[pose];
  const bones = [];
  const spheres = [];
  const info = { fingers: {}, tips: [], joints: [], mcps: [] };

  for (const [name, F] of Object.entries(FINGERS)) {
    const fl = P.flex[name];
    let A = 0;
    let pos = [...F.mcp];
    const joints = [pos];
    const yaw = rad(F.yaw);
    const dirs = [], ups = [];
    F.len.forEach((L, i) => {
      A += rad(fl[i]);
      const d = norm([Math.sin(yaw) * Math.cos(A), -Math.sin(A), Math.cos(yaw) * Math.cos(A)]);
      dirs.push(d);
      ups.push(norm([Math.sin(yaw) * Math.sin(A), Math.cos(A), Math.cos(yaw) * Math.sin(A)]));
      pos = add(pos, scale(d, L));
      joints.push(pos);
    });
    for (let i = 0; i < 3; i++) bones.push(bone(joints[i], joints[i + 1], F.r[i], F.r[i + 1], ups[i], i === 0 ? 0.92 : 0.86));
    // dorsal knuckle (MCP) and middle-joint (PIP) bumps
    spheres.push({ c: add(F.mcp, add(scale(ups[0], F.r[0] * 0.2), [0, 0, 0.002])), r: F.r[0] * 0.98 });
    spheres.push({ c: add(joints[1], scale(ups[1], F.r[1] * 0.16)), r: F.r[1] * 0.96 });
    // metacarpal ridge (the raised tendon line on the back of the hand)
    bones.push(bone([F.mcp[0] * 0.7, 0.0045, -0.084], [F.mcp[0], 0.0025, F.mcp[2] - 0.004], 0.0058, 0.0072, [0, 1, 0], 1, 0.012));
    const Adip = rad(fl[0] + fl[1] + fl[2]);
    info.fingers[name] = {
      dip: joints[2], tip: joints[3], dir: dirs[2], rDip: F.r[2], rTip: F.r[3], up: ups[2],
    };
    info.joints.push({ p: joints[1], d: dirs[0], u: ups[1] }, { p: joints[2], d: dirs[1], u: ups[2] });
    info.mcps.push({ p: F.mcp, d: dirs[0], u: ups[0] });
    void Adip;
  }

  // webs of skin between the fingers, just in front of the knuckles
  const names = ['index', 'middle', 'ring', 'pinky'];
  for (let i = 0; i < 3; i++) {
    const A = FINGERS[names[i]].mcp, B = FINGERS[names[i + 1]].mcp;
    const m = [(A[0] + B[0]) / 2, -0.0015, (A[2] + B[2]) / 2 + 0.0165];
    spheres.push({ c: m, r: 0.0058, soft: 0.01 });
  }

  // thumb
  const T = P.thumb;
  const tl = [0.044, 0.031, 0.026];
  const tr = [0.0122, 0.0108, 0.0098, 0.0090];
  let tp = [...T.cmc];
  const tj = [tp];
  T.dirs.forEach((d, i) => { tp = add(tp, scale(norm(d), tl[i])); tj.push(tp); });
  const td = norm(T.dirs[2]);
  let tup = norm([0.12, 0.62, 0.60]);
  tup = norm(sub(tup, scale(td, dot(tup, td))));
  for (let i = 0; i < 3; i++) bones.push(bone(tj[i], tj[i + 1], tr[i], tr[i + 1], i === 0 ? [0, 1, 0] : tup, 0.9));
  spheres.push({ c: add(tj[1], scale(tup, 0.001)), r: tr[1] * 0.98 });
  info.fingers.thumb = { dip: tj[2], tip: tj[3], dir: td, rDip: tr[2], rTip: tr[3], up: tup };
  info.joints.push({ p: tj[2], d: norm(T.dirs[1]), u: tup });
  // thumb-index web
  bones.push(bone([0.043, -0.010, -0.014], [0.030, -0.004, -0.001], 0.0068, 0.0066, [0, 1, 0], 1, 0.012));

  const fa = P.forearm;
  const ell = [
    { c: [0.0, 0.0035, -0.052], r: [0.0435, 0.0160, 0.055] }, // back of the hand
    { c: [0.0, -0.0075, -0.050], r: [0.0415, 0.0135, 0.052] }, // palm
    { c: [0.0, 0.0, -0.012], r: [0.0430, 0.0120, 0.0190] }, // knuckle row
    { c: [0.033, -0.0135, -0.040], r: [0.0190, 0.0140, 0.0330] }, // thenar pad (thumb muscle)
    { c: [-0.035, -0.0100, -0.050], r: [0.0125, 0.0125, 0.0370] }, // hypothenar
  ];
  const wrist = { a: [0, -0.0015, -0.092], b: [0, -0.0015, -0.150], r1: 0.0255, r2: 0.0245, ky: 0.74 };
  const arm = { a: [0, -0.0015, -0.150], b: [0, -0.0015, -0.098 - fa], r1: 0.0245, r2: 0.031, ky: 0.8 };
  info.tips = ['index', 'middle', 'ring', 'pinky', 'thumb'].map((n) => info.fingers[n].tip);
  return { bones, spheres, ell, wrist, arm, info, P };
}

function makeSDF(def) {
  const { bones, spheres, ell, wrist, arm } = def;
  const scaled = (x, y, z, c) => roundCone(x, (y - c.a[1]) / c.ky + c.a[1], z, c.a, c.b, c.r1, c.r2) * c.ky;
  return (x, y, z) => {
    let d = 1e9;
    for (const e of ell) d = smin(d, ellipsoid(x, y, z, e.c, e.r), 0.016);
    d = smin(d, scaled(x, y, z, wrist), 0.02);
    d = smin(d, scaled(x, y, z, arm), 0.02);
    for (const b of bones) d = smin(d, ellCone(x, y, z, b), b.soft);
    for (const s of spheres) d = smin(d, Math.hypot(x - s.c[0], y - s.c[1], z - s.c[2]) - s.r, s.soft || 0.0055);
    return d;
  };
}

/* ------------------------------------------------------------------ */
/*  surface nets                                                       */
/* ------------------------------------------------------------------ */

function polygonise(sdf, min, max, H) {
  const nx = Math.ceil((max[0] - min[0]) / H) + 1, ny = Math.ceil((max[1] - min[1]) / H) + 1, nz = Math.ceil((max[2] - min[2]) / H) + 1;
  const val = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[id(i, j, k)] = sdf(min[0] + i * H, min[1] + j * H, min[2] + k * H);

  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const verts = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = corner.map(([a, b, c]) => val[id(i + a, j + b, k + c)]);
    let mask = 0; for (let q = 0; q < 8; q++) if (v[q] < 0) mask |= 1 << q;
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
      sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
      sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
      n++;
    }
    cellVert[cid(i, j, k)] = verts.length;
    verts.push([min[0] + (i + sx / n) * H, min[1] + (j + sy / n) * H, min[2] + (k + sz / n) * H]);
  }

  const quads = [];
  const quad = (a, b, c, d) => { if (a >= 0 && b >= 0 && c >= 0 && d >= 0) quads.push([a, b, c, d]); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { // x edges
    const a = val[id(i, j, k)] < 0, b = val[id(i + 1, j, k)] < 0; if (a === b) continue;
    const q = [cellVert[cid(i, j - 1, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i, j - 1, k)]];
    a ? quad(q[0], q[1], q[2], q[3]) : quad(q[3], q[2], q[1], q[0]);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { // y edges
    const a = val[id(i, j, k)] < 0, b = val[id(i, j + 1, k)] < 0; if (a === b) continue;
    const q = [cellVert[cid(i - 1, j, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)]];
    a ? quad(q[3], q[2], q[1], q[0]) : quad(q[0], q[1], q[2], q[3]);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { // z edges
    const a = val[id(i, j, k)] < 0, b = val[id(i, j, k + 1)] < 0; if (a === b) continue;
    const q = [cellVert[cid(i - 1, j - 1, k)], cellVert[cid(i, j - 1, k)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)]];
    a ? quad(q[0], q[1], q[2], q[3]) : quad(q[3], q[2], q[1], q[0]);
  }

  // refine vertices onto the true surface
  const eps = H * 0.4;
  const grad = (p) => norm([
    sdf(p[0] + eps, p[1], p[2]) - sdf(p[0] - eps, p[1], p[2]),
    sdf(p[0], p[1] + eps, p[2]) - sdf(p[0], p[1] - eps, p[2]),
    sdf(p[0], p[1], p[2] + eps) - sdf(p[0], p[1], p[2] - eps),
  ]);
  for (const p of verts) for (let it = 0; it < 2; it++) { const d = sdf(p[0], p[1], p[2]); const g = grad(p); p[0] -= g[0] * d; p[1] -= g[1] * d; p[2] -= g[2] * d; }

  const nrm = verts.map((p) => grad(p));
  const idx = [];
  for (const [a, b, c, d] of quads) {
    for (const [i0, i1, i2] of [[a, b, c], [a, c, d]]) {
      const A = verts[i0], B = verts[i1], C = verts[i2];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const fn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const gn = [nrm[i0][0] + nrm[i1][0] + nrm[i2][0], nrm[i0][1] + nrm[i1][1] + nrm[i2][1], nrm[i0][2] + nrm[i1][2] + nrm[i2][2]];
      if (fn[0] * gn[0] + fn[1] * gn[1] + fn[2] * gn[2] >= 0) idx.push(i0, i1, i2); else idx.push(i0, i2, i1);
    }
  }
  return { verts, nrm, idx, grad };
}

/* ------------------------------------------------------------------ */
/*  bake one hand                                                      */
/* ------------------------------------------------------------------ */

function bake(poseName) {
  const def = buildHandDef(poseName);
  const sdf = makeSDF(def);
  const fa = def.P.forearm;
  const res = process.env.RES ? +process.env.RES : def.P.res;
  const min = [-0.062, -0.075, -0.108 - fa], max = [0.095, 0.045, 0.095];
  const t0 = Date.now();
  const mesh = polygonise(sdf, min, max, res);
  const { verts, nrm } = mesh;

  // vertex colours: crease occlusion, blush on knuckles / fingertips, joint wrinkles; alpha = how thin the flesh is
  const col = new Uint8Array(verts.length * 4);
  const tips = def.info.tips;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i], n = nrm[i];
    let occ = 0, w = 1;
    for (const d of [0.003, 0.007, 0.013]) { occ += w * Math.max(0, d - sdf(p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d)); w *= 0.5; }
    const ao = clamp01(1 - occ * 65);

    // thickness: how far inward until the flesh ends (thin at fingertips, edges, webs)
    let thick = 0.02;
    for (let d = 0.002; d <= 0.02; d += 0.002) { if (sdf(p[0] - n[0] * d, p[1] - n[1] * d, p[2] - n[2] * d) > -0.0005 * 0 && d > 0.002) { thick = d; break; } }
    const thin = clamp01(1 - (thick - 0.004) / 0.014);

    let blush = 0;
    for (const t of tips) blush = Math.max(blush, 1 - Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]) / 0.013);
    for (const m of def.info.mcps) blush = Math.max(blush, 0.7 * (1 - Math.hypot(p[0] - m.p[0], p[1] - 0.004, p[2] - m.p[2]) / 0.012));
    for (const j of def.info.joints) blush = Math.max(blush, 0.55 * (1 - Math.hypot(p[0] - j.p[0], p[1] - j.p[1], p[2] - j.p[2]) / 0.011));
    blush = clamp01(blush);

    // transverse wrinkles over the knuckles on the back of each finger
    let wr = 0;
    for (const j of def.info.joints) {
      const rel = sub(p, j.p);
      const t = dot(rel, j.d);
      const radial = Math.hypot(...sub(rel, scale(j.d, t)));
      if (radial > 0.016 || Math.abs(t) > 0.009) continue;
      if (dot(n, j.u) < 0.2) continue;
      wr = Math.max(wr, 0.5 * (1 + Math.cos((t * Math.PI * 2) / 0.0042)) * Math.exp(-((t / 0.0052) ** 2)));
    }

    let r = 0.66 + 0.34 * ao, g = 0.50 + 0.50 * ao, b = 0.47 + 0.53 * ao;
    g *= 1 - 0.14 * blush; b *= 1 - 0.18 * blush; r = Math.min(1, r + 0.04 * blush);
    const k = 1 - 0.13 * wr;
    r *= 1 - 0.05 * wr; g *= k; b *= k;
    col[i * 4] = Math.round(clamp01(r) * 255); col[i * 4 + 1] = Math.round(clamp01(g) * 255); col[i * 4 + 2] = Math.round(clamp01(b) * 255);
    col[i * 4 + 3] = Math.round(clamp01(thin * 0.8 + blush * 0.2) * 255);
  }

  // nail frames: a curve of surface points along the dorsal side of the distal phalanx
  const nails = {};
  for (const [name, f] of Object.entries(def.info.fingers)) {
    if (poseName === 'point' && name !== 'index') continue;
    const len = Math.hypot(f.tip[0] - f.dip[0], f.tip[1] - f.dip[1], f.tip[2] - f.dip[2]);
    const curve = [];
    const N = 18;
    for (let i = 0; i <= N; i++) {
      const s = 0.22 + (i / N) * (1.0 + (f.rTip * 0.9) / len - 0.22);
      const r = f.rDip + (f.rTip - f.rDip) * Math.min(1, s);
      let p = [
        f.dip[0] + (f.tip[0] - f.dip[0]) * s + f.up[0] * r * 1.2,
        f.dip[1] + (f.tip[1] - f.dip[1]) * s + f.up[1] * r * 1.2,
        f.dip[2] + (f.tip[2] - f.dip[2]) * s + f.up[2] * r * 1.2,
      ];
      if (s > 1) { // wrap over the fingertip: pull the sample forward/down onto the cap
        const t = (s - 1) * len / (f.rTip * 0.9);
        p = [
          f.tip[0] + f.dir[0] * f.rTip * 0.9 * Math.sin(t * 1.2) + f.up[0] * f.rTip * 1.1 * Math.cos(t * 1.2),
          f.tip[1] + f.dir[1] * f.rTip * 0.9 * Math.sin(t * 1.2) + f.up[1] * f.rTip * 1.1 * Math.cos(t * 1.2),
          f.tip[2] + f.dir[2] * f.rTip * 0.9 * Math.sin(t * 1.2) + f.up[2] * f.rTip * 1.1 * Math.cos(t * 1.2),
        ];
      }
      for (let it = 0; it < 6; it++) { const d = sdf(p[0], p[1], p[2]); const g = mesh.grad(p); p = [p[0] - g[0] * d, p[1] - g[1] * d, p[2] - g[2] * d]; }
      const g = mesh.grad(p);
      curve.push([...p, ...g]);
    }
    nails[name] = { curve, rDip: f.rDip, rTip: f.rTip, dir: f.dir, up: f.up };
  }
  console.log(`${poseName}: ${verts.length} verts, ${mesh.idx.length / 3} tris, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { verts, nrm, col, idx: mesh.idx, nails, tips: Object.fromEntries(Object.entries(def.info.fingers).map(([k, f]) => [k, f.tip])) };
}

/* ------------------------------------------------------------------ */
/*  glTF writer                                                        */
/* ------------------------------------------------------------------ */

function writeGLB(hands, file, extras) {
  const chunks = []; let offset = 0;
  const bufferViews = [], accessors = [];
  const push = (typed, target) => {
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (buf.length % 4)) % 4;
    chunks.push(buf, Buffer.alloc(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    offset += buf.length + pad;
    return bufferViews.length - 1;
  };
  const acc = (typed, type, ct, count, target, mm) => {
    const bv = push(typed, target);
    const a = { bufferView: bv, componentType: ct, count, type };
    if (mm) Object.assign(a, mm);
    accessors.push(a); return accessors.length - 1;
  };
  const meshes = hands.map((h) => {
    const pos = new Float32Array(h.verts.flat()), nor = new Float32Array(h.nrm.flat());
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
    const attributes = {
      POSITION: acc(pos, 'VEC3', 5126, pos.length / 3, 34962, { min: mn, max: mx }),
      NORMAL: acc(nor, 'VEC3', 5126, nor.length / 3, 34962),
      COLOR_0: acc(h.col, 'VEC4', 5121, h.col.length / 4, 34962, { normalized: true }),
    };
    const big = pos.length / 3 > 65535;
    const indices = acc(big ? new Uint32Array(h.idx) : new Uint16Array(h.idx), 'SCALAR', big ? 5125 : 5123, h.idx.length, 34963);
    return { name: h.name, primitives: [{ attributes, indices, material: 0 }] };
  });
  const json = {
    asset: { version: '2.0', generator: 'atelier build-hand', extras },
    scene: 0, scenes: [{ nodes: meshes.map((_, i) => i) }],
    nodes: meshes.map((m, i) => ({ name: m.name, mesh: i })),
    meshes, materials: [{ name: 'skin', doubleSided: false }],
    accessors, bufferViews, buffers: [{ byteLength: offset }],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(chunks);
  const total = 12 + 8 + js.length + 8 + bin.length;
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, bin]));
  return total;
}

const only = process.env.ONLY ? process.env.ONLY.split(',') : ['try', 'point'];
const hands = only.map((name) => ({ name, ...bake(name) }));
if (process.env.DUMP) {
  for (const h of hands) {
    let obj = '';
    for (const v of h.verts) obj += `v ${v[0]} ${v[1]} ${v[2]}\n`;
    for (let k = 0; k < h.idx.length; k += 3) obj += `f ${h.idx[k] + 1} ${h.idx[k + 1] + 1} ${h.idx[k + 2] + 1}\n`;
    fs.writeFileSync(`${process.env.DUMP}_${h.name}.obj`, obj);
  }
}
const nailsExtra = Object.fromEntries(hands.map((h) => [h.name, h.nails]));
const bytes = writeGLB(hands, OUT, {
  note: 'Hands for the nail shop. Metres; back of the hand = +y, fingers point +z, thumb toward +x.',
  nails: nailsExtra,
});
console.log(`wrote ${OUT} (${(bytes / 1e6).toFixed(2)} MB)`);
