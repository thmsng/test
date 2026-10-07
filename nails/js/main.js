import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { PRODUCTS, SKIN_TONES, SHAPES, makeNailMaterial, makeBareNailMaterial, shade } from './designs.js';
import { createBox, BOX } from './box.js';
import { loadHands, makeSkinMaterial } from './hand.js';
import { fingerNailGeometries } from './nail.js';

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const N = PRODUCTS.length;
const SCALE = 4.0; // visual size of the boxes
const FOV = 30;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const COL_SP = 0.72, ROW_SP = 1.06, RAIL_TOP = 1.7;
const WALL_Z = -0.16, PEG_Z = -0.045;
const STAGE_X = 9;
const FRONT_Z = PEG_Z + (BOX.HOLE_Z * -1 + 0.011) * SCALE; // world z of a hanging box's front face
const HOVER_Z = FRONT_Z + 0.004; // the fingertip glides just in front of the boxes

// physics (unit mass, world units)
const STEP = 1 / 240;
const G_W2 = 46; // pendulum ω² of a hanging box
const I_PIV = 0.0363 * (SCALE / 2.3) ** 2;
const I_YAW = 0.02;
const D_COM = BOX.HOLE_Y * SCALE;
const TAU = Math.PI * 2;

/* ================================================================== */
/*  Renderer / scene                                                   */
/* ================================================================== */

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;

const scene = new THREE.Scene();
const BG = new THREE.Color('#e9d8d1');
scene.background = BG;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 80);

const key = new THREE.DirectionalLight('#fff4ea', 1.15);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 2.6, bottom: -2.6, near: 1, far: 18 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight('#ffd7c8', 1.0); // warm rim light from behind: lifts the edges of the hand
scene.add(key, key.target, rim, rim.target);
scene.add(new THREE.HemisphereLight('#ffffff', '#e8cfc8', 0.22));

// rack wall
const wallMat = new THREE.MeshStandardMaterial({ color: '#d9c2ba', roughness: 1 });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), wallMat);
wall.position.set(0, 1.2, WALL_Z); wall.receiveShadow = true;
scene.add(wall);
const rack = new THREE.Group();
scene.add(rack);

// stage (try-on room)
const stage = new THREE.Group();
stage.position.set(STAGE_X, 0, 0);
scene.add(stage);
const backdropMat = new THREE.MeshStandardMaterial({ color: '#f1e3dd', roughness: 1 });
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), backdropMat);
backdrop.position.set(0, 1.2, -1.1); backdrop.receiveShadow = true;
stage.add(backdrop);
const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.55, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0.8, depthWrite: false });
const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), haloMat);
halo.position.set(0.2, 0.85, -1.08);
stage.add(halo);

/* ================================================================== */
/*  Assets                                                             */
/* ================================================================== */

const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const hands = await loadHands('assets/hands.glb');
const skinMat = makeSkinMaterial(SKIN_TONES[0].color);

/* ---- boxes ---- */
const boxes = PRODUCTS.map((p, i) => {
  const b = createBox(p, maxAniso);
  b.root.scale.setScalar(SCALE);
  b.meshes.forEach((m) => { m.userData.boxIndex = i; });
  scene.add(b.root);
  return {
    i, b, pivot: new THREE.Vector3(),
    th: (i % 2 ? 0.5 : -0.45) * (0.6 + 0.4 * ((i * 5) % 3) / 2), thv: 0, ph: 0, phv: 0, ps: 0, psv: 0,
    f: new THREE.Vector3(), fp: null, hover: 0, open: 0,
  };
});
const pickables = boxes.flatMap((x) => x.b.meshes);

/* ---- rack layout (4 x 2 on wide screens, 2 x 4 on tall ones) ---- */
const state = {
  mode: 'browse', sel: -1, cols: 4, mix: 0, time: 0,
  panY: 0, panYT: 0, hover: -1,
  yawUser: 0, pitchUser: 0, yawV: 0, spin: false,
  shape: null, skin: 0, press: 0,
};
const steel = new THREE.MeshStandardMaterial({ color: '#d9dadd', roughness: 0.3, metalness: 1 });
const slatMat = new THREE.MeshStandardMaterial({ color: '#f7f1ee', roughness: 0.5 });

function layout(cols) {
  state.cols = cols;
  while (rack.children.length) { const c = rack.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const rows = Math.ceil(N / cols);
  for (let r = 0; r < rows; r++) {
    const y = RAIL_TOP - r * ROW_SP;
    const slat = new THREE.Mesh(new THREE.BoxGeometry((cols - 1) * COL_SP + 0.8, 0.06, 0.04), slatMat);
    slat.position.set(0, y + 0.0, WALL_Z + 0.0175); slat.castShadow = slat.receiveShadow = true;
    rack.add(slat);
  }
  boxes.forEach((x) => {
    const r = Math.floor(x.i / cols), c = x.i % cols;
    x.pivot.set((c - (cols - 1) / 2) * COL_SP, RAIL_TOP - r * ROW_SP, PEG_Z);
    x.row = r;
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, PEG_Z - WALL_Z + 0.05, 20), steel);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(x.pivot.x, x.pivot.y, (WALL_Z + PEG_Z + 0.05) / 2 + 0.0175);
    peg.castShadow = true; rack.add(peg);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 16, 12), steel);
    cap.position.set(x.pivot.x, x.pivot.y, PEG_Z + 0.05 + 0.0175 + 0.0); cap.castShadow = true; rack.add(cap);
  });
}

/* ---- the finger cursor (a real pointing hand) ---- */
const cursor = new THREE.Group();
scene.add(cursor);
const cursorModel = new THREE.Group();
cursor.add(cursorModel);
const CURSOR_SCALE = 1.75;
const cursorSkin = new THREE.Mesh(hands.point.geometry, skinMat);
cursorSkin.castShadow = true; cursorSkin.scale.setScalar(CURSOR_SCALE);
cursorModel.add(cursorSkin);
const bareNailMat = makeBareNailMaterial();
Object.values(fingerNailGeometries(hands.point.nails, 'oval', 0)).forEach((g) => {
  const m = new THREE.Mesh(g, bareNailMat); m.scale.setScalar(CURSOR_SCALE); m.castShadow = true; cursorModel.add(m);
});
const idxCurve = hands.point.nails.index.curve;
const tipLocal = new THREE.Vector3(...idxCurve[idxCurve.length - 1].slice(0, 3)).multiplyScalar(CURSOR_SCALE);
// orientation: finger pointing up-left and into the screen, the back of the hand toward the camera
const cursorD = new THREE.Vector3(-0.10, 0.78, -0.62).normalize();
const cursorY = (() => { const v = new THREE.Vector3(0.30, 0.1, 0.95); return v.addScaledVector(cursorD, -v.dot(cursorD)).normalize(); })();
const cursorX = new THREE.Vector3().crossVectors(cursorY, cursorD);
const cursorQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(cursorX, cursorY, cursorD));
cursorModel.quaternion.copy(cursorQ);

/* ---- the try-on hand ---- */
const handRig = new THREE.Group(); // spins about the palm
stage.add(handRig);
const HAND_SCALE = 4.3;
const handModel = new THREE.Group();
handModel.position.set(0, 0, 0.05 * HAND_SCALE);
handRig.add(handModel);
const handSkin = new THREE.Mesh(hands.try.geometry, skinMat);
handSkin.castShadow = handSkin.receiveShadow = true; handSkin.scale.setScalar(HAND_SCALE);
handModel.add(handSkin);
const nailMeshes = {};
const handNails = new THREE.Group();
handModel.add(handNails);
let tryNailMat = null;
handRig.position.set(0.85, 0.66, 0.3);

function buildHandNails(shape, lengthKey) {
  Object.values(nailMeshes).forEach((m) => m.geometry.dispose());
  handNails.clear();
  const geos = fingerNailGeometries(hands.try.nails, shape, lengthKey);
  for (const [name, g] of Object.entries(geos)) {
    const m = new THREE.Mesh(g, tryNailMat); m.scale.setScalar(HAND_SCALE); m.castShadow = true;
    handNails.add(m); nailMeshes[name] = m;
  }
}

/* ================================================================== */
/*  Physics                                                            */
/* ================================================================== */

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

function physicsStep(dt, t) {
  for (const x of boxes) {
    if (x.i === state.sel) continue;
    let aTh = 0, aPh = 0, aPs = 0;
    aTh += 0.9 * (Math.sin(t * 0.93 + x.i * 1.9) + 0.6 * Math.sin(t * 1.57 + x.i * 4.1));
    aPh += 0.4 * Math.sin(t * 1.21 + x.i * 2.7);
    aTh += -G_W2 * Math.sin(x.th) - 1.3 * x.thv - 0.35 * Math.abs(x.thv) * x.thv;
    aPh += -140 * x.ph - 3.4 * x.phv;
    aPs += -70 * x.ps - 2.6 * x.psv;
    if (x.fp) {
      tmpA.copy(x.fp).sub(x.pivot);
      const tau = tmpB.copy(tmpA).cross(x.f);
      aTh += tau.z / I_PIV;
      aPh += tau.x / I_PIV;
      aPs += tau.y / I_YAW * 0.35;
    }
    x.aTh = aTh; x.aPh = aPh; x.aPs = aPs; x.ax = 0;
  }
  // neighbours in a row nudge each other
  for (const a of boxes) {
    const b = boxes[a.i + 1];
    if (!b || b.row !== a.row || a.i === state.sel || b.i === state.sel) continue;
    for (const h of [0.08, 0.2, 0.32]) {
      const hh = h * SCALE / 1.0 * 0.5 * 2; // metres below the hole in world units
      const xa = a.pivot.x + hh * Math.sin(a.th) + SCALE * 0.036 * Math.cos(a.th);
      const xb = b.pivot.x + hh * Math.sin(b.th) - SCALE * 0.036 * Math.cos(b.th);
      const pen = xa - xb;
      if (pen > 0) {
        const F = (240 * pen) / 3;
        a.aTh -= (hh * F) / I_PIV; b.aTh += (hh * F) / I_PIV;
      }
    }
  }
  for (const x of boxes) {
    if (x.i === state.sel) continue;
    x.thv += x.aTh * dt; x.th += x.thv * dt;
    x.phv += x.aPh * dt; x.ph += x.phv * dt;
    x.psv += x.aPs * dt; x.ps += x.psv * dt;
    if (x.ph > 0.2) { x.ph = 0.2; x.phv *= -0.2; } // the wall
    if (Math.abs(x.th) > 1.45) { x.th = Math.sign(x.th) * 1.45; x.thv *= -0.3; }
  }
}

function poseBox(x) {
  const r = x.b;
  r.root.position.copy(x.pivot);
  r.swing.rotation.z = x.th;
  r.tilt.rotation.x = x.ph;
  r.yaw.rotation.y = x.ps;
}

/* ================================================================== */
/*  Pointer / finger cursor                                            */
/* ================================================================== */

const pointer = { x: -999, y: -999, nx: 0, ny: 0, inside: false, down: false, moved: false };
const tip = new THREE.Vector3(0, 1, HOVER_Z), tipTarget = new THREE.Vector3(0, 1, HOVER_Z), tipPrev = new THREE.Vector3(0, 1, HOVER_Z), tipVel = new THREE.Vector3();
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -HOVER_Z);
const down = { active: false, sx: 0, sy: 0, lx: 0, ly: 0, drag: false, hit: -1 };
const tag = document.getElementById('tag');
const hintEl = document.getElementById('hint');

function pickBox(px, py) {
  ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, false);
  return hits.length ? hits[0].object.userData.boxIndex : -1;
}

canvas.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; pointer.moved = true;
  pointer.nx = (e.clientX / window.innerWidth) * 2 - 1; pointer.ny = (e.clientY / window.innerHeight) * 2 - 1;
  if (!down.active) return;
  const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
  if (!down.drag && Math.hypot(e.clientX - down.sx, e.clientY - down.sy) > 6) down.drag = true;
  if (down.drag) {
    if (state.mode === 'tryon') { state.spin = true; state.yawUser += dx * 0.011; state.yawV = THREE.MathUtils.clamp(dx * 0.011 * 18, -4, 4); state.pitchUser = THREE.MathUtils.clamp(state.pitchUser + dy * 0.004, -0.6, 0.6); }
    else if (state.cols === 2) state.panYT -= dy * 0.006;
  }
  down.lx = e.clientX; down.ly = e.clientY;
});
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.down = true; pointer.inside = true;
  down.active = true; down.sx = down.lx = e.clientX; down.sy = down.ly = e.clientY; down.drag = false;
  down.hit = state.mode === 'browse' ? pickBox(e.clientX, e.clientY) : -1;
  hintEl.classList.add('gone');
});
function release(e) {
  pointer.down = false;
  if (!down.active) return;
  down.active = false; state.spin = false;
  if (!down.drag && e.type === 'pointerup' && state.mode === 'browse' && down.hit >= 0) openTryOn(down.hit);
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
canvas.addEventListener('wheel', (e) => { if (state.mode === 'browse' && state.cols === 2) state.panYT += e.deltaY * 0.002; }, { passive: true });

/* ================================================================== */
/*  Camera                                                             */
/* ================================================================== */

const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();

function metrics() {
  const aspect = window.innerWidth / window.innerHeight;
  const cols = aspect < 0.85 ? 2 : 4;
  const rows = Math.ceil(N / cols);
  const w = (cols - 1) * COL_SP + 0.8, top = RAIL_TOP + 0.06, bot = RAIL_TOP - (rows - 1) * ROW_SP - (BOX.H * SCALE + 0.12);
  const hSpan = (top - bot) * 1.16;
  const dFit = Math.max(hSpan / (2 * TAN), (w * 1.12) / (2 * TAN * aspect));
  const dist = Math.min(dFit, cols === 2 ? 4.6 : 12);
  const visH = 2 * dist * TAN;
  const panRange = Math.max(0, (top - bot) * 1.05 - visH) / 2;
  return { aspect, cols, dist, cy: (top + bot) / 2, panRange, portrait: aspect < 0.85 };
}

function updateCamera(dt) {
  const m = metrics();
  if (m.cols !== state.cols) layout(m.cols);
  state.panYT = THREE.MathUtils.clamp(state.panYT, -m.panRange, m.panRange);
  state.panY += (state.panYT - state.panY) * (1 - Math.exp(-dt * 8));

  const par = pointer.nx * 0.06;
  const bp = new THREE.Vector3(Math.sin(par) * m.dist, m.cy + state.panY + pointer.ny * -0.05, Math.cos(par) * m.dist);
  const bt = new THREE.Vector3(0, m.cy + state.panY, 0);

  // try-on view
  const dist = m.portrait ? 5.2 : 3.0;
  const sp = new THREE.Vector3(STAGE_X + (m.portrait ? 0.2 : 0.3), m.portrait ? 1.35 : 1.12, dist);
  const st = new THREE.Vector3(STAGE_X + (m.portrait ? 0.2 : 0.3), m.portrait ? 0.95 : 0.78, 0.15);

  const target = state.mode === 'tryon' ? 1 : 0;
  state.mix += (target - state.mix) * (1 - Math.exp(-dt * 3.2));
  const e = state.mix * state.mix * (3 - 2 * state.mix);
  camPos.copy(bp).lerp(sp, e); camPos.y += Math.sin(e * Math.PI) * 0.35;
  camTgt.copy(bt).lerp(st, e);
  camera.position.copy(camPos); camera.lookAt(camTgt);

  key.position.set(camTgt.x + 3.0, camTgt.y + 3.4, camTgt.z + 5.4);
  key.target.position.copy(camTgt);
  rim.position.set(camTgt.x - 3.2, camTgt.y + 2.2, camTgt.z - 4.0); rim.target.position.copy(camTgt);
  return m;
}

/* ================================================================== */
/*  Try-on                                                             */
/* ================================================================== */

const ui = {
  panel: document.getElementById('detail'), idx: document.getElementById('d-index'), name: document.getElementById('d-name'),
  price: document.getElementById('d-price'), desc: document.getElementById('d-desc'), finish: document.getElementById('d-finish'),
  bag: document.getElementById('bag-count'), add: document.getElementById('d-add'),
  skins: document.getElementById('skins'), shapes: document.getElementById('shapes'),
};
let bag = 0;

SKIN_TONES.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'skin' + (i === 0 ? ' on' : ''); b.style.background = s.color; b.title = s.name; b.setAttribute('aria-label', s.name);
  b.addEventListener('click', () => { state.skin = i; skinMat.color.set(s.color); [...ui.skins.children].forEach((c, k) => c.classList.toggle('on', k === i)); });
  ui.skins.appendChild(b);
});
SHAPES.forEach((s) => {
  const b = document.createElement('button');
  b.className = 'shape'; b.textContent = s.label; b.dataset.shape = s.id;
  b.addEventListener('click', () => setShape(s.id));
  ui.shapes.appendChild(b);
});

function setShape(id) {
  state.shape = id;
  [...ui.shapes.children].forEach((c) => c.classList.toggle('on', c.dataset.shape === id));
  if (state.sel >= 0) {
    const p = PRODUCTS[state.sel];
    buildHandNails(id, id === p.shape ? p.length : p.length);
  }
}

const fly = { t: 1, dir: 1, from: { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1 } };
const stageBox = { p: new THREE.Vector3(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0.45, -0.04)), s: 3.4 };
/** the try-on room is laid out differently on tall (phone) screens */
function layoutStage(portrait) {
  const center = portrait ? new THREE.Vector3(STAGE_X - 0.12, 1.55, 0.4) : new THREE.Vector3(STAGE_X + 0.12, 1.12, 0.4);
  stageBox.s = portrait ? 3.0 : 3.4;
  // `root` sits at the hang hole; the body hangs below it, so offset to land the box body on `center`
  stageBox.p.copy(center).sub(new THREE.Vector3(0, -BOX.HOLE_Y, -BOX.HOLE_Z).multiplyScalar(stageBox.s).applyQuaternion(stageBox.q));
  handRig.position.set(portrait ? 0.3 : 0.85, portrait ? 0.78 : 0.66, 0.3);
  handRig.scale.setScalar(portrait ? 0.9 : 1);
}

function fillPanel(i) {
  const p = PRODUCTS[i];
  ui.idx.textContent = `${p.id} / ${String(N).padStart(2, '0')}`;
  ui.name.textContent = p.name; ui.price.textContent = `$${p.price}`; ui.desc.textContent = p.desc; ui.finish.textContent = p.finish;
  document.documentElement.style.setProperty('--tone', p.tone);
  document.documentElement.style.setProperty('--accent', p.accent);
}

function openTryOn(i) {
  if (state.mode === 'tryon' && state.sel === i) return;
  const prev = state.sel;
  if (prev >= 0 && prev !== i) { sendBack(prev); }
  state.mode = 'tryon'; state.sel = i; state.spin = false; state.yawUser = 0; state.pitchUser = 0;
  const x = boxes[i];
  poseBox(x); x.b.root.updateMatrixWorld(true);
  x.b.root.matrixWorld.decompose(fly.from.p, fly.from.q, tmpC);
  fly.from.s = SCALE; fly.t = 0; fly.dir = 1;
  if (tryNailMat) tryNailMat.dispose();
  tryNailMat = makeNailMaterial(PRODUCTS[i], maxAniso, 1.15);
  const p = PRODUCTS[i];
  state.shape = p.shape;
  buildHandNails(p.shape, p.length);
  [...ui.shapes.children].forEach((c) => c.classList.toggle('on', c.dataset.shape === p.shape));
  fillPanel(i);
  document.body.classList.add('is-tryon');
  ui.panel.setAttribute('aria-hidden', 'false');
  tag.classList.remove('show');
  backdropTarget.set(shade(p.tone, 0.02));
  x.f.set(0, 0, 0); x.fp = null;
}

function sendBack(i) {
  // re-hang a box on its peg with a little swing
  const x = boxes[i];
  x.th = (Math.random() - 0.5) * 0.6; x.thv = 0; x.ph = 0; x.phv = 0; x.ps = 0; x.psv = 0;
  x.b.setOpen(0); x.open = 0;
  poseBox(x); x.b.root.scale.setScalar(SCALE);
}

function closeTryOn() {
  if (state.mode !== 'tryon') return;
  const i = state.sel;
  fly.t = 0; fly.dir = -1; // fly back
  state.mode = 'browse';
  document.body.classList.remove('is-tryon');
  ui.panel.setAttribute('aria-hidden', 'true');
  state.closing = i;
}

function step(dir) {
  if (state.mode !== 'tryon') return;
  const next = (state.sel + dir + N) % N;
  openTryOn(next);
}

const backdropTarget = new THREE.Color('#f1e3dd');

function updateTryOn(dt) {
  layoutStage(window.innerWidth / window.innerHeight < 0.85);
  // the box flies between the rack and the stage
  const flying = state.sel >= 0 || state.closing != null;
  if (flying) {
    const i = state.closing != null ? state.closing : state.sel;
    const x = boxes[i];
    fly.t = Math.min(1, fly.t + dt / 1.25);
    const k = fly.t * fly.t * (3 - 2 * fly.t);
    const a = fly.dir > 0 ? k : 1 - k; // 0 = rack, 1 = stage
    if (fly.dir < 0 && state.closing != null && fly.t >= 1) {
      sendBack(i); state.closing = null; state.sel = -1; return;
    }
    const to = stageBox;
    x.b.root.position.copy(fly.from.p).lerp(to.p, a); x.b.root.position.y += Math.sin(a * Math.PI) * 0.25 * (fly.dir > 0 ? 1 : 0.6);
    x.b.root.quaternion.copy(fly.from.q).slerp(to.q, a);
    x.b.root.scale.setScalar(fly.from.s + (to.s - fly.from.s) * a);
    x.b.swing.rotation.set(0, 0, 0); x.b.tilt.rotation.set(0, 0, 0); x.b.yaw.rotation.set(0, 0, 0);
    // the lid opens once the box is nearly there
    const open = THREE.MathUtils.smoothstep(a, 0.55, 1.0) * 2.55;
    x.b.setOpen(open);
    // the box is drawn hanging from the origin of root: shift so the body, not the hole, lands on the stage
  }
  // hand: slow sway + user spin
  if (!state.spin) { state.yawUser += state.yawV * dt; state.yawV *= Math.exp(-dt * 4.5); }
  const sway = Math.sin(state.time * 0.55) * 0.18;
  handRig.rotation.set(0.1 + state.pitchUser, -0.32 + sway + state.yawUser, 0, 'YXZ');
  backdropMat.color.lerp(backdropTarget, 1 - Math.exp(-dt * 3));
  halo.material.opacity = 0.8;
}

/* ================================================================== */
/*  Finger cursor update                                               */
/* ================================================================== */

function updateCursor(dt) {
  const show = state.mode === 'browse' && pointer.inside;
  cursor.visible = show || (state.mode === 'browse' && cursor.userData.shown > 0.01);
  cursor.userData.shown = THREE.MathUtils.lerp(cursor.userData.shown ?? 0, show ? 1 : 0, 1 - Math.exp(-dt * 10));
  canvas.style.cursor = state.mode === 'browse' && pointer.inside ? 'none' : (state.mode === 'tryon' ? 'grab' : '');
  if (!cursor.visible) return;

  state.press += ((pointer.down ? 1 : 0) - state.press) * (1 - Math.exp(-dt * 16));
  if (pointer.inside) {
    ndc.set((pointer.x / window.innerWidth) * 2 - 1, -(pointer.y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -(HOVER_Z - 0.05 * state.press);
    if (!ray.ray.intersectPlane(plane, tipTarget)) return;
  }
  tipPrev.copy(tip);
  tip.lerp(tipTarget, 1 - Math.exp(-dt * 26));
  tipVel.copy(tip).sub(tipPrev).divideScalar(Math.max(dt, 1 / 240));

  // place the model so the index tip sits at `tip`
  const off = tmpA.copy(tipLocal).applyQuaternion(cursorQ);
  cursor.position.copy(tip).sub(off);
  cursor.scale.setScalar(cursor.userData.shown * 0.4 + 0.6);
}

/* contact between the fingertip and the boxes */
function updateContacts() {
  for (const x of boxes) { if (!x.hold) { x.f.set(0, 0, 0); x.fp = null; } }
  state.hover = -1;
  if (state.mode !== 'browse' || !pointer.inside) { tag.classList.remove('show'); return; }
  const tipR = 0.012;
  let best = -1, bestPen = 0;
  for (const x of boxes) {
    const local = x.b.body.worldToLocal(tmpA.copy(tip));
    const inX = Math.abs(local.x) < BOX.W / 2 + tipR / SCALE, inY = Math.abs(local.y) < BOX.H / 2 + tipR / SCALE;
    if (!inX || !inY) continue;
    const pen = (0.0110 + 0.004 / SCALE * 1.5) - local.z; // metres into the front face
    if (local.z < -0.004) continue;
    if (pen > -0.02) { state.hover = x.i; }
    if (pen > 0) {
      const n = tmpB.set(0, 0, 1).transformDirection(x.b.body.matrixWorld);
      const F = tmpC.copy(n).multiplyScalar(-pen * SCALE * 900);
      // light drag along the surface as the finger glides over it
      F.x += THREE.MathUtils.clamp(tipVel.x, -3, 3) * 5.5; F.y += THREE.MathUtils.clamp(tipVel.y, -3, 3) * 5.5;
      if (F.length() > 18) F.setLength(18);
      x.f.copy(F); x.fp = tip.clone();
      if (pen > bestPen) { bestPen = pen; best = x.i; }
    }
  }
  if (state.hover >= 0) {
    const p = PRODUCTS[state.hover];
    tag.innerHTML = `<b>${p.name}</b><span>$${p.price}</span>`;
    tag.style.transform = `translate(${pointer.x + 26}px, ${pointer.y + 18}px)`;
    tag.classList.add('show');
  } else tag.classList.remove('show');
  void best;
}

/* ================================================================== */
/*  UI wiring                                                          */
/* ================================================================== */

document.getElementById('d-close').addEventListener('click', closeTryOn);
document.getElementById('d-prev').addEventListener('click', () => step(-1));
document.getElementById('d-next').addEventListener('click', () => step(1));
ui.add.addEventListener('click', () => {
  bag += 1; ui.bag.textContent = bag; ui.add.textContent = 'Added ✓';
  setTimeout(() => { ui.add.textContent = 'Add to bag'; }, 1200);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTryOn(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
});

/* ================================================================== */
/*  Loop                                                               */
/* ================================================================== */

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
layout(metrics().cols);

let acc = 0, physT = 0, last = performance.now(), first = true;
for (const x of boxes) poseBox(x);

function simulate(dt) {
  acc += dt;
  while (acc >= STEP) { physicsStep(STEP, physT); physT += STEP; acc -= STEP; }
  for (const x of boxes) if (x.i !== state.sel && x.i !== state.closing) poseBox(x);
  updateTryOn(dt);
  updateCamera(dt);
  updateCursor(dt);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  state.time += dt;
  updateContacts();
  simulate(dt);
  renderer.render(scene, camera);
  if (first) { first = false; document.body.classList.add('ready'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__nails = {
  camera, handRig, scene, THREE,
  open: openTryOn, close: closeTryOn, state, boxes, pointer, tip,
  advance(sec) { for (let t = 0; t < sec; t += 1 / 60) { state.time += 1 / 60; updateContacts(); simulate(1 / 60); } scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); },
  snapshot() { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
  moveFinger(x, y, down = false) { pointer.x = x; pointer.y = y; pointer.nx = (x / innerWidth) * 2 - 1; pointer.ny = (y / innerHeight) * 2 - 1; pointer.inside = true; pointer.down = down; },
  screenOf(i) { const v = new THREE.Vector3(0, 0, 0.01); boxes[i].b.body.localToWorld(v); v.project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; },
};
