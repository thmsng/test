import * as THREE from 'three';

const V3 = THREE.Vector3;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** half width at distance d from a rounded end of radius r, for a body of half width hw */
const rounded = (d, r, hw) => (d >= r ? hw : hw - r + Math.sqrt(Math.max(0, r * r - (r - d) * (r - d))));

/** half width of a nail of the given shape at t in [0,1] along its length */
function halfWidth(shape, t, L, hw0) {
  const dEnd = (1 - t) * L, dCut = t * L;
  let w, rEnd;
  switch (shape) {
    case 'square': w = hw0; rEnd = hw0 * 0.22; break;
    case 'coffin': w = hw0 * (1 - 0.36 * smooth(0.5, 0.93, t)); rEnd = hw0 * 0.2; break;
    case 'stiletto': w = hw0 * (1 - 0.9 * Math.pow(smooth(0.22, 1, t), 0.95)); rEnd = hw0 * 0.1; break;
    case 'oval': w = hw0; rEnd = hw0 * 0.98; break;
    case 'almond':
    default: w = hw0 * (1 - 0.6 * smooth(0.42, 1, t)); rEnd = Math.max(w * 0.7, hw0 * 0.22);
  }
  w = Math.min(rounded(dEnd, Math.min(rEnd, L * 0.45), w), rounded(dCut, hw0 * 0.9, hw0));
  return Math.max(0, w);
}

/* ------------------------------------------------------------------ */
/*  frames                                                             */
/* ------------------------------------------------------------------ */

function orthoFrames(pts) {
  // pts: [{p, n, r}] -> adds t and b
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)].p, b = pts[Math.min(pts.length - 1, i + 1)].p;
    const t = b.clone().sub(a).normalize();
    const n = pts[i].n.clone().addScaledVector(t, -pts[i].n.dot(t)).normalize();
    pts[i].t = t; pts[i].n = n; pts[i].b = new V3().crossVectors(t, n).normalize();
  }
  return pts;
}

function resample(frames, count) {
  const cum = [0];
  for (let i = 1; i < frames.length; i++) cum.push(cum[i - 1] + frames[i].p.distanceTo(frames[i - 1].p));
  const L = cum[cum.length - 1];
  const out = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const s = (k / (count - 1)) * L;
    while (j < frames.length - 1 && cum[j] < s) j++;
    const t = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    const a = frames[j - 1], b = frames[j];
    out.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), r: a.r + (b.r - a.r) * t });
  }
  return { frames: orthoFrames(out), length: L };
}

/** frames following the finger from the cuticle to the tip, then continuing past it for a free edge */
export function fingerFrames(info, extend, startIdx = 0) {
  const curve = info.curve.slice(startIdx);
  const pts = curve.map((c, i) => ({
    p: new V3(c[0], c[1], c[2]), n: new V3(c[3], c[4], c[5]),
    r: info.rDip + (info.rTip - info.rDip) * (i / (curve.length - 1)),
  }));
  orthoFrames(pts);
  const last = pts[pts.length - 1];
  const step = 0.0008;
  const K = Math.max(0, Math.round(extend / step));
  let p = last.p.clone(), t = last.t.clone(), n = last.n.clone();
  const b = last.b.clone();
  const curl = 0.55 / Math.max(1, K);
  for (let k = 1; k <= K; k++) {
    const c = Math.cos(curl), s = Math.sin(curl);
    const t2 = t.clone().multiplyScalar(c).addScaledVector(n, -s);
    const n2 = n.clone().multiplyScalar(c).addScaledVector(t, s);
    t = t2.normalize(); n = n2.normalize();
    p = p.clone().addScaledVector(t, step);
    pts.push({ p, n: n.clone(), r: last.r + (0.0095 - last.r) * (k / K) });
  }
  return pts;
}

export function trayFrames(length) {
  const pts = [];
  for (let i = 0; i <= 4; i++) pts.push({ p: new V3(0, (i / 4) * length, 0), n: new V3(0, 0, 1), r: 0.0095 });
  return pts;
}

/* ------------------------------------------------------------------ */
/*  shell                                                              */
/* ------------------------------------------------------------------ */

export function nailGeometry(frames, { shape = 'almond', hw0 = 0.006, rows = 36, cols = 13, lift = 0.0005 } = {}) {
  const { frames: F, length } = resample(frames, rows);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const hw = halfWidth(shape, t, length, hw0);
    const f = F[i];
    for (let j = 0; j < cols; j++) {
      const s = (j / (cols - 1)) * 2 - 1;
      const lat = s * hw;
      const R = Math.max(0.0042, f.r);
      const l2 = Math.min(Math.abs(lat), R * 0.96) * Math.sign(lat);
      const sag = R - Math.sqrt(R * R - l2 * l2);
      const q = f.p.clone().addScaledVector(f.b, lat).addScaledVector(f.n, lift - sag);
      pos.push(q.x, q.y, q.z);
      uv.push(0.5 + lat / (2 * hw0), t);
    }
  }
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the normals face outward (the same side as the frame normal)
  const n = g.attributes.normal;
  let dot = 0;
  for (let i = 0; i < rows; i++) { const k = i * cols + (cols >> 1); dot += n.getX(k) * F[i].n.x + n.getY(k) * F[i].n.y + n.getZ(k) * F[i].n.z; }
  if (dot < 0) {
    const ix = g.index.array;
    for (let k = 0; k < ix.length; k += 3) { const tmp = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = tmp; }
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  return g;
}

/** extra length beyond the fingertip for a shape / length setting (metres) */
export function extension(shape, lengthKey) {
  const base = [0.0015, 0.0060, 0.0105][lengthKey] ?? 0.006;
  return base + (shape === 'stiletto' ? 0.004 : shape === 'coffin' ? 0.002 : 0);
}

const NAIL_HW = { thumb: 0.82, index: 0.98, middle: 0.98, ring: 0.98, pinky: 0.98 };

/** one geometry per finger, fitted to the hand surface */
export function fingerNailGeometries(nailInfo, shape, lengthKey) {
  const out = {};
  for (const [name, info] of Object.entries(nailInfo)) {
    const frames = fingerFrames(info, extension(shape, lengthKey));
    const hw0 = NAIL_HW[name] * 0.5 * (info.rDip + info.rTip);
    out[name] = nailGeometry(frames, { shape, hw0 });
  }
  return out;
}

/** a set of press-on nails lying on the tray (merged into one geometry) */
export function trayNailGeometry(shape, lengthKey, mergeGeometries) {
  const S = 0.62; // the display set is shown at a reduced scale so ten nails fit the window
  const widths = [0.0155, 0.0125, 0.013, 0.0115, 0.0095].map((w) => w * S);
  const lens = [0.0175, 0.0155, 0.0165, 0.0145, 0.0125].map((l) => l * S);
  const geos = [];
  const ext = extension(shape, lengthKey) * 0.5 * S;
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 5; k++) {
      const L = lens[k] + ext;
      const frames = trayFrames(L).map((f) => ({ ...f, r: 0.0065 }));
      const g = nailGeometry(frames, { shape, hw0: widths[k] / 2, rows: 18, cols: 9 });
      g.translate((k - 2) * 0.0098, -L * 0.5 + (row === 0 ? 0.0185 : -0.0185), 0);
      geos.push(g);
    }
  }
  return mergeGeometries(geos);
}
