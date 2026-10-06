import * as THREE from 'three';
import { makePrintTexture } from './designs.js';

export const SHIRT_H = 0.70; // hem -> neck, metres
export const HOOK_R = 0.0165; // radius of the hook loop that wraps the rail
export const HANGER_DROP = 0.075; // rail centre -> hanger arms (neck)

const NR = 72; // points around the body
const NV = 46; // rings up the body
const P = 2.5; // super-ellipse exponent of the cross-section

/* ---------- small helpers ---------- */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function interp(keys, v) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [v0, a0] = keys[i], [v1, a1] = keys[i + 1];
    if (v <= v1) return a0 + (a1 - a0) * ((v - v0) / (v1 - v0));
  }
  return keys[keys.length - 1][1];
}
function blur(arr, passes = 3) {
  for (let p = 0; p < passes; p++) {
    const c = arr.slice();
    for (let i = 1; i < arr.length - 1; i++) arr[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4;
  }
}

// half-width / half-depth of the torso by height (0 = hem, 1 = neck)
const W_KEYS = [[0, 0.249], [0.1, 0.256], [0.5, 0.264], [0.8, 0.267], [0.9, 0.256], [0.96, 0.195], [1, 0.108]];
const D_KEYS = [[0, 0.100], [0.15, 0.108], [0.5, 0.118], [0.8, 0.118], [0.9, 0.108], [0.96, 0.088], [1, 0.066]];
const U_REF = 0.27; // print panel half width (metres)

/* ---------- torso ---------- */

function buildBody(seed) {
  const rand = mulberry32(seed * 131 + 7);
  const ph = Array.from({ length: 6 }, () => rand() * Math.PI * 2);

  const wA = [], dA = [];
  for (let j = 0; j <= NV; j++) { const v = j / NV; wA.push(interp(W_KEYS, v)); dA.push(interp(D_KEYS, v)); }
  blur(wA, 3); blur(dA, 3);

  const pos = [], uv = [], aH = [];
  const ex = 2 / P;
  const ringTop = [], ringHem = [];

  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    const w = wA[j], d = dA[j];
    const kTop = smoothstep(0.78, 1.0, v);
    for (let i = 0; i <= NR; i++) {
      const a = (i / NR) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      let x = w * spow(c, ex);
      let z = d * spow(s, ex);
      const xr = x / U_REF;

      // drape folds: soft vertical creases, strongest low on the body
      const lowW = 0.35 + 0.65 * (1 - v);
      const f =
        Math.sin(5 * a + ph[0] + v * 1.5) * 0.5 +
        Math.sin(9 * a + ph[1] + v * 5.0) * 0.32 +
        Math.sin(14 * a + ph[2] - v * 7.0) * 0.18;
      const off = 0.009 * f * lowW * (0.5 + 0.5 * Math.abs(s));
      const nx = x / (w * w), nz = z / (d * d), nl = Math.hypot(nx, nz) || 1;
      x += (nx / nl) * off; z += (nz / nl) * off;

      let y = v * SHIRT_H;
      // curved, slightly wavy hem
      const hemW = Math.pow(1 - v, 7);
      y += hemW * (0.016 * c * c + 0.007 * Math.sin(3 * a + ph[3]) + 0.004 * Math.sin(8 * a + ph[4]));
      // neckline: scoop at the front, lifted back
      y -= 0.072 * kTop * Math.pow(Math.max(0, s), 1.7);
      y += 0.012 * kTop * Math.pow(Math.max(0, -s), 1.5);

      pos.push(x, y, z);
      const front = s >= 0;
      uv.push(front ? 0.75 + 0.25 * xr : 0.25 - 0.25 * xr, v);
      aH.push(Math.min(1, Math.max(0, 1 - y / SHIRT_H)));
      if (i < NR) {
        if (j === NV) ringTop.push(new THREE.Vector3(x, y, z));
        if (j === 0) ringHem.push(new THREE.Vector3(x, y, z));
      }
    }
  }

  const idx = [];
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NR; i++) {
      const a = j * (NR + 1) + i, b = a + 1, c = a + NR + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld normals across the seam
  const n = g.attributes.normal;
  for (let j = 0; j <= NV; j++) {
    const a = j * (NR + 1), b = a + NR;
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
  }
  return { geometry: g, ringTop, ringHem };
}

/* ---------- sleeves ---------- */

const NRS = 44; // around
const NL = 20; // along

function buildSleeve(side, seed) {
  const rand = mulberry32(seed * 57 + (side > 0 ? 3 : 11));
  const ph = Array.from({ length: 4 }, () => rand() * Math.PI * 2);
  const ang = 0.60 + (rand() - 0.5) * 0.06;
  const D = new THREE.Vector2(side * Math.cos(ang), -Math.sin(ang));
  const N = side > 0 ? new THREE.Vector2(-D.y, D.x) : new THREE.Vector2(D.y, -D.x); // "up-outward"
  const S0 = new THREE.Vector3(side * 0.155, 0.598, 0.0);
  const L = 0.30;

  const pos = [], uv = [], aH = [];
  const endRing = [];
  for (let l = 0; l <= NL; l++) {
    const t = l / NL;
    const cx = S0.x + D.x * L * t;
    const cy = S0.y + D.y * L * t - 0.032 * t * t;
    const rz = (0.072 + (0.108 - 0.072) * smoothstep(0, 0.45, t)) * (1 - 0.08 * t);
    const rn = rz * (0.9 - 0.06 * t);
    for (let k = 0; k <= NRS; k++) {
      const p = (k / NRS) * Math.PI * 2;
      const cp = Math.cos(p), sp = Math.sin(p);
      let a = rn * cp, b = rz * sp;
      const f = Math.sin(4 * p + ph[0] + t * 3) * 0.55 + Math.sin(7 * p + ph[1] - t * 4) * 0.45;
      const amp = 0.0055 * f * (0.4 + t);
      a += cp * amp; b += sp * amp;
      const x = cx + N.x * a, y = cy + N.y * a, z = b;
      pos.push(x, y, z);
      uv.push(k / NRS, t);
      aH.push(Math.min(1, Math.max(0, 1 - y / SHIRT_H)));
      if (l === NL && k < NRS) endRing.push(new THREE.Vector3(x, y, z));
    }
  }
  const idx = [];
  for (let l = 0; l < NL; l++) {
    for (let k = 0; k < NRS; k++) {
      const a = l * (NRS + 1) + k, b = a + 1, c = a + NRS + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let l = 0; l <= NL; l++) {
    const a = l * (NRS + 1), b = a + NRS;
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
  }
  return { geometry: g, endRing };
}

/* ---------- rolled edge (hem / cuff / collar) ---------- */

function edgeTube(points, radius, tubular = 140, seed = 0) {
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  const g = new THREE.TubeGeometry(curve, tubular, radius, 8, true);
  const aH = new Float32Array(g.attributes.position.count);
  for (let i = 0; i < aH.length; i++) aH[i] = Math.min(1, Math.max(0, 1 - g.attributes.position.getY(i) / SHIRT_H));
  g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  return g;
}

/* ---------- hanger ---------- */

function buildHanger() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#cdb892', roughness: 0.5, metalness: 0.0 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c6c9ce', roughness: 0.28, metalness: 1.0 });

  // arms: a thin, gently curved flat bar
  const half = 0.19, thick = 0.017;
  const top = (x) => -0.055 * Math.pow(Math.abs(x) / half, 1.6);
  const shape = new THREE.Shape();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const x = -half + (2 * half * i) / steps;
    if (i === 0) shape.moveTo(x, top(x)); else shape.lineTo(x, top(x));
  }
  shape.absarc(half, top(half) - thick / 2, thick / 2, Math.PI / 2, -Math.PI / 2, true);
  for (let i = steps; i >= 0; i--) {
    const x = -half + (2 * half * i) / steps;
    shape.lineTo(x, top(x) - thick);
  }
  shape.absarc(-half, top(-half) - thick / 2, thick / 2, -Math.PI / 2, -Math.PI * 1.5, true);
  const arms = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 12,
  });
  arms.translate(0, 0, -0.006);
  const armsMesh = new THREE.Mesh(arms, wood);
  armsMesh.castShadow = true;
  group.add(armsMesh);

  // neck block + stem (yaw group)
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.018, 20), wood);
  block.position.y = -0.002; block.castShadow = true;
  group.add(block);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.06, 12), metal);
  stem.position.y = 0.032;
  stem.castShadow = true;
  group.add(stem);

  // hook loop (swing group): wraps around the rail
  const hookPts = [];
  const r = HOOK_R;
  hookPts.push(new THREE.Vector3(0, -HANGER_DROP + 0.058, r)); // top of stem
  hookPts.push(new THREE.Vector3(0, -0.012, r));
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 1.55;
    hookPts.push(new THREE.Vector3(0, r * Math.sin(a), r * Math.cos(a)));
  }
  const hookCurve = new THREE.CatmullRomCurve3(hookPts, false, 'centripetal');
  const hook = new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 64, 0.0036, 8, false), metal);
  hook.castShadow = true;
  return { yawPart: group, hook };
}

/* ---------- fabric shader patch (hem lag + flutter) ---------- */

function patchDisplace(material, uniforms, backShade) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLag = uniforms.uLag;
    shader.uniforms.uFlutter = uniforms.uFlutter;
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aH; uniform vec2 uLag; uniform float uFlutter; uniform float uTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float kk = aH * aH;
        transformed.x += uLag.x * kk;
        transformed.z += uLag.y * kk;
        transformed.y -= (abs(uLag.x) + abs(uLag.y)) * 0.35 * kk;
        float fl = uFlutter * aH;
        transformed.x += sin(transformed.y * 21.0 + uTime * 6.0 + position.z * 9.0) * fl;
        transformed.z += sin(transformed.y * 17.0 - uTime * 5.0 + position.x * 11.0) * fl;`);
    if (backShade) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'if (!gl_FrontFacing) outgoingLight *= 0.62;\n#include <opaque_fragment>'
      );
    }
  };
  material.customProgramCacheKey = () => (backShade ? 'fabric-displace' : 'depth-displace');
}

/* ---------- public ---------- */

export function createShirt(product, index, fabricBump, maxAniso) {
  const seed = index + 1;
  const uniforms = { uLag: { value: new THREE.Vector2() }, uFlutter: { value: 0 }, uTime: { value: 0 } };

  const printTex = makePrintTexture(product, maxAniso);
  const bump = fabricBump.clone(); bump.needsUpdate = true; bump.repeat.set(70, 90);
  const bumpSleeve = fabricBump.clone(); bumpSleeve.needsUpdate = true; bumpSleeve.repeat.set(60, 20);
  const bumpRib = fabricBump.clone(); bumpRib.needsUpdate = true; bumpRib.repeat.set(160, 4);

  const col = new THREE.Color(product.color);
  const sheen = col.clone().lerp(new THREE.Color('#ffffff'), 0.55);
  const common = {
    roughness: 0.4, metalness: 0, sheen: 1, sheenRoughness: 0.28, sheenColor: sheen,
    clearcoat: 0.25, clearcoatRoughness: 0.35, specularIntensity: 0.9, side: THREE.DoubleSide,
  };

  const bodyMat = new THREE.MeshPhysicalMaterial({ ...common, map: printTex, bumpMap: bump, bumpScale: 0.35 });
  const sleeveMat = new THREE.MeshPhysicalMaterial({ ...common, color: col, bumpMap: bumpSleeve, bumpScale: 0.35 });
  const ribMat = new THREE.MeshPhysicalMaterial({ ...common, sheen: 0.3, color: col.clone().multiplyScalar(0.92), bumpMap: bumpRib, bumpScale: 0.6 });
  [bodyMat, sleeveMat, ribMat].forEach((m) => patchDisplace(m, uniforms, true));

  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  patchDisplace(depthMat, uniforms, false);

  const body = buildBody(seed);
  const slvR = buildSleeve(1, seed);
  const slvL = buildSleeve(-1, seed);

  const shirt = new THREE.Group();
  const meshes = [];
  const add = (geo, mat, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    m.customDepthMaterial = depthMat;
    shirt.add(m); meshes.push(m);
    return m;
  };
  add(body.geometry, bodyMat);
  add(slvR.geometry, sleeveMat);
  add(slvL.geometry, sleeveMat);
  add(edgeTube(body.ringHem, 0.0055, 160), ribMat);
  add(edgeTube(body.ringTop, 0.0095, 120), ribMat);
  add(edgeTube(slvR.endRing, 0.0055, 80), ribMat);
  add(edgeTube(slvL.endRing, 0.0055, 80), ribMat);
  shirt.position.y = -SHIRT_H - 0.0085;

  const hanger = buildHanger();

  // hierarchy: root (rail position) -> swing (rot x/z about the rail) -> yaw (rot y) -> hanger + shirt
  const root = new THREE.Group();
  const swing = new THREE.Group();
  const yaw = new THREE.Group();
  root.add(swing);
  swing.add(hanger.hook);
  swing.add(yaw);
  yaw.position.set(0, -HANGER_DROP, HOOK_R);
  yaw.add(hanger.yawPart);
  yaw.add(shirt);
  hanger.hook.castShadow = true;

  const pickables = [...meshes.slice(0, 3), hanger.yawPart.children[0]];
  pickables.forEach((m) => { m.userData.shirtIndex = index; });

  return { root, swing, yaw, shirt, uniforms, pickables, product };
}
