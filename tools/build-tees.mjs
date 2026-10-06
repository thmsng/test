/**
 * Builds a real garment asset: a t-shirt cut from flat pattern pieces
 * (front, back, two sleeves), sewn together with welded seams, hung on a
 * wooden hanger and draped with a position-based cloth simulation. The
 * settled result is baked into a binary glTF (several drape variants).
 *
 *   node build-tees.mjs ../atelier/assets/tees.glb [variants]
 */
import Delaunator from 'delaunator';
import fs from 'node:fs';

const OUT = process.argv[2] || '../atelier/assets/tees.glb';
const NVAR = +(process.argv[3] || 8);
const H = 0.0105; // target edge length (m)

/* ------------------------------------------------------------------ */
/*  tiny math helpers                                                  */
/* ------------------------------------------------------------------ */

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function polyLength(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
function dense(fn, N = 600) { return Array.from({ length: N + 1 }, (_, i) => fn(i / N)); }
/** n+1 points equally spaced by arclength along a polyline */
function resample(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const out = []; let j = 1;
  for (let k = 0; k <= n; k++) {
    const target = (k / n) * L;
    while (j < pts.length - 1 && cum[j] < target) j++;
    const t = (target - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    out.push([lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)]);
  }
  return out;
}
const count = (pts) => Math.max(2, Math.round(polyLength(pts) / H));

function pointInPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function distToPoly(x, y, poly) {
  let best = 1e9;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  garment definition                                                 */
/* ------------------------------------------------------------------ */

// hanger the shirt hangs on (shirt coordinates; y up, hem at y = 0)
const NECK_Y = 0.70, NECK_X = 0.092;
const SH_TIP_X = 0.225, SH_TIP_Y = 0.655;
const ARM_R = 0.0085;
const ARM_HALF = 0.205;
const shoulderY = (x, s) => NECK_Y - ((NECK_Y - SH_TIP_Y) / (SH_TIP_X * s - NECK_X)) * (Math.abs(x) - NECK_X);
const armCenterY = (x, s) => shoulderY(x, s) - (ARM_R + 0.004);

/** Free parameters per drape variant */
function variantParams(i) {
  const r = rng(1000 + i * 77);
  return {
    seed: i,
    scale: 0.97 + r() * 0.06,
    wind: 0.5 + r() * 0.9,
    windPhase: r() * 6.28,
    inflate: 0.25 + r() * 0.45,
    sleeveAngle: 0.50 + r() * 0.18,
    shift: (r() - 0.5) * 0.006,
  };
}

function build(vp) {
  const s = vp.scale;
  const wh = 0.268 * s, wu = 0.26 * s, yu = 0.42, xs = SH_TIP_X * s;
  const neckDrop = { F: 0.078, B: 0.022 };
  const scoop = { F: 0.022, B: 0.012 };

  /* ---- pattern edges (right half, x >= 0) ---- */
  const hemE = [[0, 0], [wh, 0]];
  const sideE = [[wh, 0], [wu, yu]];
  const armE = (k) => dense((t) => [lerp(wu, xs, t) - scoop[k] * Math.sin(Math.PI * t), lerp(yu, SH_TIP_Y, t)]);
  const shE = [[xs, SH_TIP_Y], [NECK_X, NECK_Y]];
  const neckE = (k) => dense((t) => { const f = t * Math.PI / 2; return [NECK_X * Math.cos(f), NECK_Y - neckDrop[k] * Math.sin(f)]; });

  const nHem = count(hemE), nSide = count(sideE), nSh = count(shE);
  const nArm = Math.max(4, Math.round((polyLength(armE('F')) + polyLength(armE('B'))) / 2 / H));
  const nNeck = { F: count(neckE('F')), B: count(neckE('B')) };

  const sideP = resample(sideE, nSide), shP = resample(shE, nSh);
  const armP = { F: resample(armE('F'), nArm), B: resample(armE('B'), nArm) };
  const neckP = { F: resample(neckE('F'), nNeck.F), B: resample(neckE('B'), nNeck.B) };
  const hemP = resample(hemE, nHem);

  /* ---- sleeve pattern ---- */
  const Larm = (polyLength(armE('F')) + polyLength(armE('B'))) / 2;
  const SW = 0.40, SA = SW / 2; // flat width = bicep circumference
  const ellQuarter = (b) => { // quarter arc of ellipse (a = SA, b)
    let L = 0, px = SA, py = 0;
    for (let i = 1; i <= 400; i++) { const f = (i / 400) * Math.PI / 2; const x = SA * Math.cos(f), y = b * Math.sin(f); L += Math.hypot(x - px, y - py); px = x; py = y; }
    return L;
  };
  let lo = 0.02, hi = 0.3;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (ellQuarter(mid) < Larm) lo = mid; else hi = mid; }
  const capH = (lo + hi) / 2;
  const capL = dense((t) => { const f = Math.PI - t * Math.PI / 2; return [SA * Math.cos(f), capH * Math.sin(f)]; }); // left end -> peak
  const capLP = resample(capL, nArm);
  const SLEEVE_LEN = 0.20, CUFF_A = 0.185;
  const sideSl = [[-SA, 0], [-CUFF_A, -SLEEVE_LEN]];
  const nU = count(sideSl);
  const uarP = resample(sideSl, nU); // left edge points (k = 0..nU)
  const nCuff = Math.max(4, Math.round(2 * CUFF_A / H));

  /* ---- global vertices ---- */
  const V = []; // {x,y,z, layer, pin}
  const reg = new Map();
  const keyOf = (id) => { for (const [k, v] of reg) if (v === id) return k; return ''; };
  const getV = (key, init = {}) => {
    if (!reg.has(key)) { reg.set(key, V.length); V.push({ x: 0, y: 0, z: 0, layer: 0, pin: false, ...init }); }
    return reg.get(key);
  };

  /** boundary loop entry */
  const E = (id, p, extra) => ({ id, p, ...extra });

  function bodyLoop(piece) { // piece 'F' | 'B'
    const loop = [];
    const k = piece;
    const addSide = (sg) => { // sg = +1 right, -1 left (x mirrored)
      const X = (p) => [p[0] * sg, p[1]];
      const sideId = (i) => (i === 0 ? getV('HC' + sg) : i === nSide ? getV('U' + sg) : getV('side' + sg + ':' + i));
      const armId = (i) => (i === 0 ? getV('U' + sg) : i === nArm ? getV('P' + sg) : getV(`arm${k}${sg}:${i}`));
      const shId = (i) => (i === 0 ? getV('P' + sg) : i === nSh ? getV('N' + sg) : getV('sh' + sg + ':' + i));
      const neckId = (i) => (i === 0 ? getV('N' + sg) : i === nNeck[k] ? getV('C' + k) : getV(`neck${k}${sg}:${i}`));
      return { X, sideId, armId, shId, neckId };
    };
    const R = addSide(1), Lf = addSide(-1);
    // hem centre -> right corner
    loop.push(E(getV('HM' + k), [0, 0]));
    for (let i = 1; i < nHem; i++) loop.push(E(getV(`hem${k}+:${i}`), [hemP[i][0], 0]));
    // up the right side, armhole, shoulder, neck to centre
    for (let i = 0; i <= nSide; i++) loop.push(E(R.sideId(i), R.X(sideP[i])));
    for (let i = 1; i <= nArm; i++) loop.push(E(R.armId(i), R.X(armP[k][i])));
    for (let i = 1; i <= nSh; i++) loop.push(E(R.shId(i), R.X(shP[i])));
    for (let i = 1; i <= nNeck[k]; i++) loop.push(E(R.neckId(i), R.X(neckP[k][i])));
    // left half, traversed in the opposite direction
    for (let i = nNeck[k] - 1; i >= 0; i--) loop.push(E(Lf.neckId(i), Lf.X(neckP[k][i])));
    for (let i = nSh - 1; i >= 0; i--) loop.push(E(Lf.shId(i), Lf.X(shP[i])));
    for (let i = nArm - 1; i >= 0; i--) loop.push(E(Lf.armId(i), Lf.X(armP[k][i])));
    for (let i = nSide - 1; i >= 0; i--) loop.push(E(Lf.sideId(i), Lf.X(sideP[i])));
    for (let i = nHem - 1; i >= 1; i--) loop.push(E(getV(`hem${k}-:${i}`), [-hemP[i][0], 0]));
    return loop;
  }

  function sleeveLoop(sg) {
    const loop = [];
    const uId = (kk) => (kk === 0 ? getV('U' + sg) : getV(`uar${sg}:${kk}`));
    const cuffId = (i) => getV(`cuff${sg}:${i}`);
    // cuff, left corner -> right corner
    loop.push(E(uId(nU), uarP[nU]));
    for (let i = 1; i < nCuff; i++) loop.push(E(cuffId(i), [lerp(-CUFF_A, CUFF_A, i / nCuff), -SLEEVE_LEN]));
    // right edge: bottom -> up
    for (let kk = nU; kk >= 0; kk--) loop.push(E(uId(kk), [-uarP[kk][0], uarP[kk][1]], { right: true }));
    // cap right half: right end (U) -> peak (P); sleeve cap i (from the end) <-> armB[i]
    for (let i = 1; i <= nArm; i++) {
      const p = [-capLP[i][0], capLP[i][1]];
      loop.push(E(i === nArm ? getV('P' + sg) : getV(`armB${sg}:${i}`), p));
    }
    // cap left half: peak -> left end; sleeve cap i <-> armF[i]
    for (let i = nArm - 1; i >= 1; i--) loop.push(E(getV(`armF${sg}:${i}`), capLP[i]));
    // left edge: top -> bottom handled by the first push (uId(nU)) ... add the remaining left-edge points
    for (let kk = 0; kk < nU; kk++) loop.push(E(uId(kk), uarP[kk], { left: true }));
    return loop;
  }

  /* ---- triangulate a piece ---- */
  const tris = []; // {a,b,c, piece, p2: [[x,y],[x,y],[x,y]]}
  function triangulate(loop, piece, layerOf) {
    const poly = loop.map((e) => e.p);
    let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
    for (const [x, y] of poly) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    const pts = poly.map((p) => [p[0], p[1]]);
    const ids = loop.map((e) => e.id);
    const rowH = H * 0.866;
    for (let r = 0, y = ymin + rowH * 0.5; y < ymax; y += rowH, r++) {
      for (let x = xmin + (r % 2) * H * 0.5; x < xmax; x += H) {
        if (!pointInPoly(x, y, poly)) continue;
        if (distToPoly(x, y, poly) < 0.78 * H) continue;
        const id = V.length; V.push({ x: 0, y: 0, z: 0, layer: layerOf(x), pin: false });
        pts.push([x, y]); ids.push(id);
      }
    }
    const del = new Delaunator(pts.flat());
    for (let t = 0; t < del.triangles.length; t += 3) {
      const ia = del.triangles[t], ib = del.triangles[t + 1], ic = del.triangles[t + 2];
      const A = pts[ia], B = pts[ib], C = pts[ic];
      const area = ((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
      if (Math.abs(area) < 1e-9) continue;
      const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3;
      if (!pointInPoly(cx, cy, poly)) continue;
      // skip triangles with a vertex repeated (welded seam corner) or fully degenerate
      const ga = ids[ia], gb = ids[ib], gc = ids[ic];
      if (ga === gb || gb === gc || ga === gc) continue;
      if (area > 0) tris.push({ a: ga, b: gb, c: gc, piece, p2: [A, B, C] });
      else tris.push({ a: ga, b: gc, c: gb, piece, p2: [A, C, B] });
    }
  }

  const frontLoop = bodyLoop('F');
  const backLoop = bodyLoop('B');
  triangulate(frontLoop, 'F', () => 1);
  triangulate(backLoop, 'B', () => -1);
  const slR = sleeveLoop(1), slL = sleeveLoop(-1);
  const sleeveLayer = (px) => (px < -1e-4 ? 1 : px > 1e-4 ? -1 : 0);
  triangulate(slR, 'SR', sleeveLayer);
  triangulate(slL, 'SL', sleeveLayer);

  // free boundary vertices (hem, neck, cuff) belong to a single layer
  for (const e of frontLoop) if (V[e.id].layer === 0 && !/^(side|U|P|N|HC|sh|arm)/.test(keyOf(e.id))) V[e.id].layer = 1;
  for (const e of backLoop) if (V[e.id].layer === 0 && !/^(side|U|P|N|HC|sh|arm)/.test(keyOf(e.id))) V[e.id].layer = -1;
  for (const loop of [slR, slL]) for (const e of loop) if (/^cuff/.test(keyOf(e.id))) V[e.id].layer = sleeveLayer(e.p[0]);

  /* ---- initial 3D placement ---- */
  const DELTA = 0.004;
  // seam vertices on the body: positions from the pattern
  const seamPos = new Map();
  const setP = (id, x, y, z) => { V[id].x = x; V[id].y = y; V[id].z = z; seamPos.set(id, true); };
  for (const loop of [frontLoop, backLoop]) for (const e of loop) {
    const k = keyOf(e.id);
    const isSeam = /^(side|U|P|N|HC|sh|arm)/.test(k);
    if (isSeam) setP(e.id, e.p[0], e.p[1], 0);
  }
  // free body boundary + interior: pattern position with a small front/back offset that fades near seams
  const seamIds = [...seamPos.keys()];
  const sidePts = seamIds.map((id) => V[id]);
  const placed = new Set(seamIds);
  for (const t of tris) {
    if (t.piece !== 'F' && t.piece !== 'B') continue;
    [[t.a, 0], [t.b, 1], [t.c, 2]].forEach(([id, c]) => {
      if (placed.has(id)) return;
      const [px, py] = t.p2[c];
      let dmin = 1e9;
      for (const q of sidePts) dmin = Math.min(dmin, Math.hypot(q.x - px, q.y - py));
      const z = (t.piece === 'F' ? 1 : -1) * DELTA * smooth(0, 0.05, dmin);
      V[id].x = px; V[id].y = py; V[id].z = z; placed.add(id);
    });
  }
  // sleeves: flatten outward along the sleeve axis, anchored on the armhole polylines
  const armPoly = (sg, k) => { // polyline of 3D armhole vertices from U (0) to P (nArm)
    const pts = [];
    for (let i = 0; i <= nArm; i++) {
      const id = i === 0 ? getV('U' + sg) : i === nArm ? getV('P' + sg) : getV(`arm${k}${sg}:${i}`);
      pts.push(V[id]);
    }
    return pts;
  };
  const capY = (px) => capH * Math.sqrt(Math.max(0, 1 - (px / SA) ** 2));
  const halfW = (py) => lerp(SA, CUFF_A, Math.min(1, Math.max(0, -py / SLEEVE_LEN)));
  for (const sg of [1, -1]) {
    const axis = [sg * Math.cos(vp.sleeveAngle), -Math.sin(vp.sleeveAngle)];
    const polyF = armPoly(sg, 'F'), polyB = armPoly(sg, 'B');
    const at = (poly, f) => { const x = f * nArm; const i = Math.min(nArm - 1, Math.floor(x)); const t = x - i; return [lerp(poly[i].x, poly[i + 1].x, t), lerp(poly[i].y, poly[i + 1].y, t), lerp(poly[i].z, poly[i + 1].z, t)]; };
    for (const t of tris) {
      if (t.piece !== (sg > 0 ? 'SR' : 'SL')) continue;
      [[t.a, 0], [t.b, 1], [t.c, 2]].forEach(([id, c]) => {
        if (placed.has(id)) return;
        const [px, py] = t.p2[c];
        const tw = Math.min(1, Math.abs(px) / halfW(py));
        const f = 1 - tw;
        const A = at(px <= 0 ? polyF : polyB, f);
        const depth = Math.max(0, capY(Math.max(-SA, Math.min(SA, px * (SA / halfW(py))))) - py - (px === 0 ? 0 : 0));
        V[id].x = A[0] + axis[0] * depth;
        V[id].y = A[1] + axis[1] * depth;
        V[id].z = A[2] + (px <= 0 ? 1 : -1) * DELTA * Math.sin(Math.PI * tw) * 0.6;
        placed.add(id);
      });
    }
  }
  // shift for asymmetry
  for (const v of V) v.x += vp.shift * smooth(0.0, 0.7, v.y);

  // pins: the shoulder seam (neck point to shoulder tip) rests on the hanger arms
  for (const sg of [1, -1]) {
    for (let i = 0; i <= nSh; i++) {
      const id = i === 0 ? getV('P' + sg) : i === nSh ? getV('N' + sg) : getV('sh' + sg + ':' + i);
      V[id].pin = true;
    }
  }

  /* ---- orientation: make every triangle face outward ---- */
  const flipPiece = {};
  for (const piece of ['F', 'B', 'SR', 'SL']) {
    let sum = 0;
    for (const t of tris) {
      if (t.piece !== piece) continue;
      const a = V[t.a], b = V[t.b], c = V[t.c];
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
      const nz = ux * vy - uy * vx;
      const zc = (a.z + b.z + c.z) / 3;
      const lay = (piece === 'F') ? 1 : (piece === 'B') ? -1 : (t.p2[0][0] + t.p2[1][0] + t.p2[2][0]) / 3 < 0 ? 1 : -1;
      sum += nz * lay;
      void uz; void vz; void zc;
    }
    flipPiece[piece] = sum < 0;
  }
  for (const t of tris) if (flipPiece[t.piece]) { const tmp = t.b; t.b = t.c; t.c = tmp; const tp = t.p2[1]; t.p2[1] = t.p2[2]; t.p2[2] = tp; }

  return { V, tris, reg, params: { nArm, nSh, wu, xs } };
}

/* ------------------------------------------------------------------ */
/*  cloth simulation (position based dynamics)                         */
/* ------------------------------------------------------------------ */

function simulate(model, vp) {
  const { V, tris } = model;
  const n = V.length;
  const x = new Float64Array(n * 3), prev = new Float64Array(n * 3);
  const inv = new Float64Array(n);
  const layer = new Int8Array(n);
  for (let i = 0; i < n; i++) { x[i * 3] = V[i].x; x[i * 3 + 1] = V[i].y; x[i * 3 + 2] = V[i].z; inv[i] = V[i].pin ? 0 : 1; layer[i] = V[i].layer; }
  prev.set(x);
  const pin = x.slice();

  // stretch constraints (deduplicated; rest length averaged from every triangle that uses the edge)
  const emap = new Map();
  const addEdge = (a, b, p, q) => {
    const key = a < b ? a * n + b : b * n + a;
    const L = Math.hypot(p[0] - q[0], p[1] - q[1]);
    const e = emap.get(key);
    if (e) { e.sum += L; e.cnt++; } else emap.set(key, { a: Math.min(a, b), b: Math.max(a, b), sum: L, cnt: 1 });
  };
  for (const t of tris) { addEdge(t.a, t.b, t.p2[0], t.p2[1]); addEdge(t.b, t.c, t.p2[1], t.p2[2]); addEdge(t.c, t.a, t.p2[2], t.p2[0]); }
  const S = [...emap.values()];
  const sa = new Int32Array(S.length), sb = new Int32Array(S.length), sr = new Float64Array(S.length);
  S.forEach((e, i) => { sa[i] = e.a; sb[i] = e.b; sr[i] = e.sum / e.cnt; });

  // bending constraints: opposite corners of triangle pairs that share an edge inside the same piece
  const edgeTris = new Map();
  tris.forEach((t, ti) => {
    [[t.a, t.b, 0, 1, 2], [t.b, t.c, 1, 2, 0], [t.c, t.a, 2, 0, 1]].forEach(([u, v, iu, iv, io]) => {
      const key = (u < v ? u : v) * n + (u < v ? v : u);
      if (!edgeTris.has(key)) edgeTris.set(key, []);
      edgeTris.get(key).push({ ti, o: t[['a', 'b', 'c'][io]], p: t.p2[io], pu: t.p2[iu], pv: t.p2[iv], u, v });
    });
  });
  const B = [];
  for (const list of edgeTris.values()) {
    if (list.length !== 2) continue;
    const [A, C] = list;
    if (tris[A.ti].piece !== tris[C.ti].piece) continue;
    // same geometric edge in the pattern?
    const same = (A.u === C.u) ? (Math.hypot(A.pu[0] - C.pu[0], A.pu[1] - C.pu[1]) < 1e-9 && Math.hypot(A.pv[0] - C.pv[0], A.pv[1] - C.pv[1]) < 1e-9)
      : (Math.hypot(A.pu[0] - C.pv[0], A.pu[1] - C.pv[1]) < 1e-9 && Math.hypot(A.pv[0] - C.pu[0], A.pv[1] - C.pu[1]) < 1e-9);
    if (!same) continue;
    B.push([A.o, C.o, Math.hypot(A.p[0] - C.p[0], A.p[1] - C.p[1])]);
  }
  const ba = Int32Array.from(B.map((b) => b[0])), bb = Int32Array.from(B.map((b) => b[1])), br = Float64Array.from(B.map((b) => b[2]));

  // arm colliders (capsules along the hanger arms)
  const s = vp.scale;
  const arms = [1, -1].map((sg) => ({
    x0: 0, y0: armCenterY(0, s), x1: sg * ARM_HALF, y1: armCenterY(ARM_HALF, s),
  }));

  // spatial hash for front/back layer collisions
  const CELL = 0.012, RC = 0.0068;
  const frontIds = [], backIds = [];
  for (let i = 0; i < n; i++) { if (layer[i] === 1) frontIds.push(i); else if (layer[i] === -1) backIds.push(i); }

  const DT = 1 / 90, STEPS = +(process.env.STEPS || 800), ITERS = 12;
  const KS = 1.0, KB = +(process.env.KB || 0.8);
  const rand = rng(vp.seed * 31 + 5);
  const phase = vp.windPhase;
  let lastSpeed = 0;

  for (let step = 0; step < STEPS; step++) {
    const time = step * DT;
    const windAmp = vp.wind * Math.exp(-time * 0.55);
    for (let i = 0; i < n; i++) {
      if (inv[i] === 0) continue;
      const k = i * 3;
      const vx = (x[k] - prev[k]) * 0.985, vy = (x[k + 1] - prev[k + 1]) * 0.985, vz = (x[k + 2] - prev[k + 2]) * 0.985;
      prev[k] = x[k]; prev[k + 1] = x[k + 1]; prev[k + 2] = x[k + 2];
      const h = x[k + 1];
      // gravity, a decaying breeze, and slight inflation of the two layers (air trapped inside the garment)
      const ax = windAmp * Math.sin(time * 3.1 + phase + h * 7) * 0.8;
      const az = windAmp * Math.sin(time * 2.3 + phase * 1.7 + x[k] * 9);
      const infl = layer[i] * vp.inflate * smooth(0.0, 0.5, 0.7 - h) * 0.5;
      x[k] += vx + ax * DT * DT;
      x[k + 1] += vy - 9.81 * DT * DT;
      x[k + 2] += vz + (az + infl) * DT * DT;
    }
    for (let it = 0; it < ITERS; it++) {
      // stretch
      for (let c = 0; c < sa.length; c++) {
        const a = sa[c] * 3, b = sb[c] * 3;
        const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const wa = inv[sa[c]], wb = inv[sb[c]];
        const w = wa + wb; if (w === 0) continue;
        const corr = ((d - sr[c]) / d) * KS / w;
        x[a] += dx * corr * wa; x[a + 1] += dy * corr * wa; x[a + 2] += dz * corr * wa;
        x[b] -= dx * corr * wb; x[b + 1] -= dy * corr * wb; x[b + 2] -= dz * corr * wb;
      }
      // bending
      for (let c = 0; c < ba.length; c++) {
        const a = ba[c] * 3, b = bb[c] * 3;
        const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const wa = inv[ba[c]], wb = inv[bb[c]];
        const w = wa + wb; if (w === 0) continue;
        const corr = ((d - br[c]) / d) * KB / w;
        x[a] += dx * corr * wa; x[a + 1] += dy * corr * wa; x[a + 2] += dz * corr * wa;
        x[b] -= dx * corr * wb; x[b + 1] -= dy * corr * wb; x[b + 2] -= dz * corr * wb;
      }
      // hanger arms
      for (let i = 0; i < n; i++) {
        if (inv[i] === 0) continue;
        const k = i * 3;
        for (const A of arms) {
          const dx = A.x1 - A.x0, dy = A.y1 - A.y0;
          const t = Math.max(0, Math.min(1, ((x[k] - A.x0) * dx + (x[k + 1] - A.y0) * dy) / (dx * dx + dy * dy)));
          const cx = A.x0 + dx * t, cy = A.y0 + dy * t;
          const ox = x[k] - cx, oy = x[k + 1] - cy, oz = x[k + 2];
          const d = Math.sqrt(ox * ox + oy * oy + oz * oz);
          const R = ARM_R + 0.0035;
          if (d < R) {
            const m = (R - d) / (d || 1e-9);
            x[k] += ox * m; x[k + 1] += oy * m; x[k + 2] += oz * m || (layer[i] * (R - d));
          }
        }
      }
      // front vs back layer
      if (it % 2 === 0) {
        const grid = new Map();
        for (const j of backIds) {
          const key = ((Math.floor(x[j * 3] / CELL) * 73856093) ^ (Math.floor(x[j * 3 + 1] / CELL) * 19349663) ^ (Math.floor(x[j * 3 + 2] / CELL) * 83492791));
          let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(j);
        }
        for (const i of frontIds) {
          const ci = Math.floor(x[i * 3] / CELL), cj = Math.floor(x[i * 3 + 1] / CELL), ck = Math.floor(x[i * 3 + 2] / CELL);
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
            const l = grid.get(((ci + a) * 73856093) ^ ((cj + b) * 19349663) ^ ((ck + c) * 83492791));
            if (!l) continue;
            for (const j of l) {
              const dx = x[i * 3] - x[j * 3], dy = x[i * 3 + 1] - x[j * 3 + 1], dz = x[i * 3 + 2] - x[j * 3 + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= RC * RC) continue;
              const d = Math.sqrt(d2) || 1e-9;
              // the front layer should stay on the +z side: bias the push along z when almost coincident
              let nx = dx / d, ny = dy / d, nz = dz / d;
              if (d < 1e-4) { nx = 0; ny = 0; nz = 1; }
              const push = (RC - d) * 0.5;
              const wi = inv[i], wj = inv[j], w = wi + wj; if (w === 0) continue;
              x[i * 3] += nx * push * 2 * wi / w; x[i * 3 + 1] += ny * push * 2 * wi / w; x[i * 3 + 2] += nz * push * 2 * wi / w;
              x[j * 3] -= nx * push * 2 * wj / w; x[j * 3 + 1] -= ny * push * 2 * wj / w; x[j * 3 + 2] -= nz * push * 2 * wj / w;
            }
          }
        }
      }
      // pins
      for (let i = 0; i < n; i++) if (inv[i] === 0) { x[i * 3] = pin[i * 3]; x[i * 3 + 1] = pin[i * 3 + 1]; x[i * 3 + 2] = pin[i * 3 + 2]; }
    }
    if (step === STEPS - 1) {
      let sp = 0; for (let i = 0; i < n * 3; i++) sp += Math.abs(x[i] - prev[i]);
      lastSpeed = sp / n / 3;
    }
  }
  void rand;
  return { x, lastSpeed, S: sa.length, Bn: ba.length };
}

/* ------------------------------------------------------------------ */
/*  mesh finishing: normals, UVs, hem / collar / cuff tubes            */
/* ------------------------------------------------------------------ */

function finish(model, x) {
  const { V, tris, reg } = model;
  const n = V.length;
  // smooth normals on the welded mesh
  const nrm = new Float64Array(n * 3);
  for (const t of tris) {
    const [a, b, c] = [t.a * 3, t.b * 3, t.c * 3];
    const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2];
    const vx = x[c] - x[a], vy = x[c + 1] - x[a + 1], vz = x[c + 2] - x[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
    nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l;
  }

  // render vertices: one per (welded vertex, piece) so UVs can differ across seams
  const rmap = new Map(); const pos = [], nor = [], uv = [], idx = [];
  const rv = (id, piece, p2) => {
    const key = id * 4 + ['F', 'B', 'SR', 'SL'].indexOf(piece);
    if (rmap.has(key)) return rmap.get(key);
    const i = pos.length / 3; rmap.set(key, i);
    pos.push(x[id * 3], x[id * 3 + 1], x[id * 3 + 2]);
    nor.push(nrm[id * 3], nrm[id * 3 + 1], nrm[id * 3 + 2]);
    let u, v;
    if (piece === 'F') { u = 0.5 + 0.5 * (p2[0] + 0.3) / 0.6; v = p2[1] / 0.72; }
    else if (piece === 'B') { u = 0.5 - 0.5 * (p2[0] + 0.3) / 0.6; v = p2[1] / 0.72; }
    else { u = 0.5; v = 0.5; }
    uv.push(u, v);
    return i;
  };
  for (const t of tris) {
    idx.push(rv(t.a, t.piece, t.p2[0]), rv(t.b, t.piece, t.p2[1]), rv(t.c, t.piece, t.p2[2]));
  }

  // boundary loops (free edges) -> rolled edges
  const ec = new Map();
  const addE = (a, b) => { const k = a < b ? a + ':' + b : b + ':' + a; ec.set(k, (ec.get(k) || 0) + 1); };
  for (const t of tris) { addE(t.a, t.b); addE(t.b, t.c); addE(t.c, t.a); }
  const adj = new Map();
  for (const [k, c] of ec) if (c === 1) { const [a, b] = k.split(':').map(Number); (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
  const seen = new Set(); const loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [start]; seen.add(start);
    let cur = start, prevV = -1;
    for (;;) {
      const nb = adj.get(cur).filter((q) => q !== prevV && !seen.has(q));
      const next = nb[0];
      if (next === undefined) break;
      loop.push(next); seen.add(next); prevV = cur; cur = next;
    }
    loops.push(loop);
  }
  const info = loops.map((l) => {
    let my = 0, mx = 0; for (const i of l) { my += x[i * 3 + 1]; mx += x[i * 3]; }
    return { l, my: my / l.length, mx: mx / l.length };
  });
  const tubes = [];
  for (const L of info) {
    let radius = 0.0052;
    if (L.my > 0.6) radius = 0.0088; // collar
    else if (L.my < 0.3 && Math.abs(L.mx) < 0.1) radius = 0.0048; // hem
    tubes.push({ pts: L.l.map((i) => [x[i * 3], x[i * 3 + 1], x[i * 3 + 2]]), radius });
  }
  const tp = [], tn = [], ti = [];
  for (const T of tubes) {
    const P = T.pts, m = P.length, R = 8;
    const c = [0, 0, 0]; for (const p of P) { c[0] += p[0] / m; c[1] += p[1] / m; c[2] += p[2] / m; }
    const base = tp.length / 3;
    for (let i = 0; i < m; i++) {
      const a = P[(i + m - 1) % m], b = P[(i + 1) % m], p = P[i];
      let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = Math.hypot(...t) || 1; t = t.map((q) => q / tl);
      let o = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; const d = o[0] * t[0] + o[1] * t[1] + o[2] * t[2]; o = [o[0] - t[0] * d, o[1] - t[1] * d, o[2] - t[2] * d];
      const ol = Math.hypot(...o) || 1; o = o.map((q) => q / ol);
      const bn = [t[1] * o[2] - t[2] * o[1], t[2] * o[0] - t[0] * o[2], t[0] * o[1] - t[1] * o[0]];
      for (let k = 0; k < R; k++) {
        const th = (k / R) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const nx = o[0] * cs + bn[0] * sn, ny = o[1] * cs + bn[1] * sn, nz = o[2] * cs + bn[2] * sn;
        tp.push(p[0] + nx * T.radius, p[1] + ny * T.radius, p[2] + nz * T.radius);
        tn.push(nx, ny, nz);
      }
    }
    for (let i = 0; i < m; i++) for (let k = 0; k < R; k++) {
      const a = base + i * R + k, b = base + i * R + (k + 1) % R, c2 = base + ((i + 1) % m) * R + k, d = base + ((i + 1) % m) * R + (k + 1) % R;
      ti.push(a, b, c2, b, d, c2);
    }
  }
  void reg;
  return { cloth: { pos, nor, uv, idx }, rib: { pos: tp, nor: tn, idx: ti }, loops: loops.length };
}

/* ------------------------------------------------------------------ */
/*  glTF binary writer                                                 */
/* ------------------------------------------------------------------ */

function writeGLB(meshes, file, extras) {
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
  const acc = (typed, type, componentType, count, target, minmax) => {
    const bv = push(typed, target);
    const a = { bufferView: bv, componentType, count, type };
    if (minmax) Object.assign(a, minmax);
    accessors.push(a);
    return accessors.length - 1;
  };
  const prim = (g, material) => {
    const pos = new Float32Array(g.pos), nor = new Float32Array(g.nor);
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
    const attributes = { POSITION: acc(pos, 'VEC3', 5126, pos.length / 3, 34962, { min: mn, max: mx }), NORMAL: acc(nor, 'VEC3', 5126, nor.length / 3, 34962) };
    if (g.uv) attributes.TEXCOORD_0 = acc(new Float32Array(g.uv), 'VEC2', 5126, g.uv.length / 2, 34962);
    const big = pos.length / 3 > 65535;
    const indices = acc(big ? new Uint32Array(g.idx) : new Uint16Array(g.idx), 'SCALAR', big ? 5125 : 5123, g.idx.length, 34963);
    return { attributes, indices, material };
  };
  const glMeshes = meshes.map((m, i) => ({ name: 'tee' + i, primitives: [prim(m.cloth, 0), prim(m.rib, 1)] }));
  const json = {
    asset: { version: '2.0', generator: 'atelier build-tees', extras },
    scene: 0, scenes: [{ nodes: glMeshes.map((_, i) => i) }],
    nodes: glMeshes.map((_, i) => ({ name: 'tee' + i, mesh: i })),
    meshes: glMeshes,
    materials: [{ name: 'cloth', doubleSided: true }, { name: 'rib', doubleSided: true }],
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

/* ------------------------------------------------------------------ */

const meshes = [];
const dump = process.env.DUMP; // optional: write a quick OBJ for debugging
for (let i = 0; i < NVAR; i++) {
  const t0 = Date.now();
  const vp = variantParams(i);
  const model = build(vp);
  const sim = simulate(model, vp);
  const out = finish(model, sim.x);
  meshes.push(out);
  console.log(`tee${i}: ${model.V.length} verts, ${model.tris.length} tris, ${sim.S} stretch / ${sim.Bn} bend, ` +
    `rest speed ${sim.lastSpeed.toExponential(1)}, boundary loops ${out.loops}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (dump && i === 0) {
    let obj = '';
    for (let k = 0; k < out.cloth.pos.length; k += 3) obj += `v ${out.cloth.pos[k]} ${out.cloth.pos[k + 1]} ${out.cloth.pos[k + 2]}\n`;
    for (let k = 0; k < out.cloth.idx.length; k += 3) obj += `f ${out.cloth.idx[k] + 1} ${out.cloth.idx[k + 1] + 1} ${out.cloth.idx[k + 2] + 1}\n`;
    fs.writeFileSync(dump, obj);
  }
}
const bytes = writeGLB(meshes, OUT, {
  note: 'Shirt-space units are metres; y up, hem at y = 0. The hanger arms sit under the shoulder seam.',
  hanger: { neckY: NECK_Y, armR: ARM_R, armHalf: ARM_HALF, slope: (NECK_Y - SH_TIP_Y) / (SH_TIP_X - NECK_X), armTopY0: armCenterY(0, 1) + ARM_R },
});
console.log(`wrote ${OUT} (${(bytes / 1e6).toFixed(2)} MB)`);
