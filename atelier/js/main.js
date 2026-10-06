import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { PRODUCTS, makeFabricBump } from './designs.js';
import { createShirt, SHIRT_H, HANGER_DROP } from './shirt.js';

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const N = PRODUCTS.length;
const SCALE = 2.0; // visual size of the garments
const SPACING = 0.64; // distance between hangers on the rail
const RAIL_Y = 1.72;
const RAIL_HALF = SPACING * (N - 1) / 2 + 0.5;
const WALL_Z = -1.5;
const FOV = 32;

// physics (unit mass; lengths in metres)
const STEP = 1 / 240;
const G_W2 = 18.9; // pendulum ω² of a shirt on a hanger (≈ 0.69 Hz)
const PH_W2 = 40; // tilt along the rail is held by the width of the hook
const I_PIVOT = 0.2027 * SCALE * SCALE; // moment of inertia about the rail
const D_COM = 0.39 * SCALE; // rail → centre of mass
const I_YAW = 0.05;
const HEM_L = 0.74 * SCALE; // rail → hem

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
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const BG = new THREE.Color('#f5f2ea');
scene.background = BG;
scene.fog = new THREE.Fog(BG, 9, 22);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);

// lights
const key = new THREE.DirectionalLight('#ffffff', 2.2);
key.position.set(3.4, 2.9, 5.2);
key.target.position.set(0, 0.9, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -6; key.shadow.camera.right = 6;
key.shadow.camera.top = 4.2; key.shadow.camera.bottom = -4.2;
key.shadow.camera.near = 1; key.shadow.camera.far = 16;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.012;
key.shadow.radius = 5;
scene.add(key, key.target);
scene.add(new THREE.HemisphereLight('#ffffff', '#e6e3dc', 0.5));

// wall
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 16),
  new THREE.MeshStandardMaterial({ color: '#d6d3cc', roughness: 1, metalness: 0 })
);
wall.position.set(0, 2, WALL_Z);
wall.receiveShadow = true;
scene.add(wall);

// rail + ceiling rods
const steel = new THREE.MeshStandardMaterial({ color: '#8d9197', roughness: 0.32, metalness: 1 });
const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, RAIL_HALF * 2 + 6, 24), steel);
rail.rotation.z = Math.PI / 2;
rail.position.set(0, RAIL_Y, 0);
rail.castShadow = true;
scene.add(rail);
for (const sx of [-1, 1]) {
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 4, 12), steel);
  rod.position.set(sx * (RAIL_HALF + 0.35), RAIL_Y + 2, 0);
  rod.castShadow = true;
  scene.add(rod);
}

/* ================================================================== */
/*  Shirts + physics state                                             */
/* ================================================================== */

const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const fabricBump = makeFabricBump(maxAniso);

const hangers = PRODUCTS.map((product, i) => {
  const shirt = createShirt(product, i, fabricBump, maxAniso);
  shirt.root.scale.setScalar(SCALE);
  scene.add(shirt.root);
  const restYaw = Math.PI / 2 + ((i * 0.37) % 1 - 0.5) * 0.12;
  const home = (i - (N - 1) / 2) * SPACING;
  return {
    i, shirt, home, restYaw,
    x: home, vx: 0,
    th: (i % 2 ? 0.55 : -0.5) * (0.7 + 0.3 * ((i * 7) % 3) / 2), thv: 0,
    ph: (i % 3 - 1) * 0.06, phv: 0,
    yaw: restYaw + (i % 2 ? 0.25 : -0.25), yawv: 0, yawTarget: restYaw,
    lag: new THREE.Vector2(), lagv: new THREE.Vector2(),
    flutter: 0, ax: 0,
    f: new THREE.Vector3(), fp: null, // external force this frame (world), and where it acts
    grabbed: false, spinning: false,
  };
});
const pickables = hangers.flatMap((h) => h.shirt.pickables);

const state = {
  mode: 'browse', // 'browse' | 'detail'
  sel: -1,
  detailMix: 0,
  orbitYaw: 0.3, orbitPitch: 0.03, panX: 0,
  orbitYawT: 0.3, orbitPitchT: 0.03, panXT: 0,
  hover: -1,
  time: 0,
};

function setHomes() {
  hangers.forEach((h) => {
    if (state.mode === 'browse') h.home = (h.i - (N - 1) / 2) * SPACING;
    else if (h.i === state.sel) h.home = 0;
    else if (h.i < state.sel) h.home = -(2.7 + (state.sel - 1 - h.i) * 0.5);
    else h.home = 2.7 + (h.i - state.sel - 1) * 0.5;
  });
}

/* ================================================================== */
/*  Physics                                                            */
/* ================================================================== */

const tmpV = new THREE.Vector3();
const tmpR = new THREE.Vector3();
const tmpT = new THREE.Vector3();
const COLL_H = [0.12, 0.4, 0.68].map((h) => h * SCALE);

function poseHanger(h) {
  const s = h.shirt;
  s.root.position.set(h.x, RAIL_Y, 0);
  s.swing.rotation.set(h.th, 0, h.ph);
  s.yaw.rotation.y = h.yaw;
}

const grab = { h: null, local: new THREE.Vector3(), target: new THREE.Vector3(), plane: new THREE.Plane() };

function extent(h) {
  return SCALE * (0.125 * Math.abs(Math.sin(h.yaw)) + 0.30 * Math.abs(Math.cos(h.yaw)));
}

function physicsStep(dt, t) {
  // spring forces from user (grab) — evaluated from the current pose
  if (grab.h) {
    const h = grab.h;
    poseHanger(h);
    h.shirt.root.updateMatrixWorld(true);
    tmpV.copy(grab.local);
    h.shirt.yaw.localToWorld(tmpV);
    h.f.copy(grab.target).sub(tmpV).multiplyScalar(70);
    if (h.f.length() > 36) h.f.setLength(36);
    h.fp = tmpV.clone();
  }

  for (const h of hangers) {
    const i = h.i;
    let aTh = 0, aPh = 0, aYaw = 0, aX = 0;

    // gentle breeze so the rack is never perfectly still
    aTh += 0.55 * (Math.sin(t * 0.83 + i * 1.9) + 0.6 * Math.sin(t * 1.37 + i * 4.1));
    aPh += 0.30 * Math.sin(t * 1.11 + i * 2.7);
    aYaw += 0.12 * Math.sin(t * 0.61 + i * 3.3);

    // gravity + friction
    aTh += -G_W2 * Math.sin(h.th) - (h.grabbed ? 4.5 : 0.65) * h.thv - 0.10 * Math.abs(h.thv) * h.thv;
    aPh += -PH_W2 * Math.sin(h.ph) - (h.grabbed ? 4.5 : 1.0) * h.phv;
    if (Math.abs(h.th) > 1.3) aTh -= 90 * (Math.abs(h.th) - 1.3) * Math.sign(h.th);

    // yaw spring toward its rest / target orientation
    const detail = state.mode === 'detail' && h.i === state.sel;
    if (!h.spinning) {
      const target = h.yawTarget;
      aYaw += -(detail ? 16 : 7.5) * (h.yaw - target) - (detail ? 4.8 : 1.1) * h.yawv;
    } else {
      h.yawv *= 0.9;
    }

    // slide along the rail
    aX += 9 * (h.home - h.x) - 5.2 * h.vx;

    // external force (user drag / hover brush)
    if (h.fp) {
      tmpR.copy(h.fp).sub(tmpT.set(h.x, RAIL_Y, 0));
      const tau = tmpV.copy(tmpR).cross(h.f);
      aTh += tau.x / I_PIVOT;
      aPh += tau.z / I_PIVOT;
      aYaw += tau.y / I_YAW * 0.35;
      aX += 0.6 * h.f.x;
    }
    h.ax = aX;
    h.aTh = aTh; h.aPh = aPh; h.aYaw = aYaw;
  }

  // neighbour collisions (soft penalty between hangers sorted along the rail)
  const order = hangers.slice().sort((a, b) => a.x - b.x);
  for (let k = 0; k < order.length - 1; k++) {
    const a = order[k], b = order[k + 1];
    const ea = extent(a), eb = extent(b);
    for (const hh of COLL_H) {
      const xa = a.x + hh * Math.sin(a.ph) + ea;
      const xb = b.x + hh * Math.sin(b.ph) - eb;
      const pen = xa - xb;
      if (pen > 0) {
        const va = a.vx + hh * Math.cos(a.ph) * a.phv;
        const vb = b.vx + hh * Math.cos(b.ph) * b.phv;
        const rel = va - vb;
        const F = (260 * pen + (rel > 0 ? 9 * rel : 0)) / COLL_H.length;
        a.ax -= F; b.ax += F;
        a.aPh -= (hh * F) / I_PIVOT; b.aPh += (hh * F) / I_PIVOT;
      }
    }
  }

  for (const h of hangers) {
    // pivot acceleration drives the pendulum (inertial force)
    h.aPh -= (D_COM / I_PIVOT) * h.ax;

    h.vx += h.ax * dt; h.x += h.vx * dt;
    h.thv += h.aTh * dt; h.th += h.thv * dt;
    h.phv += h.aPh * dt; h.ph += h.phv * dt;
    h.yawv += h.aYaw * dt; if (!h.spinning) h.yaw += h.yawv * dt;
    if (Math.abs(h.ph) > 0.7) { h.ph = Math.sign(h.ph) * 0.7; h.phv *= -0.3; }
  }
}

function updateCloth(dt, t) {
  for (const h of hangers) {
    // velocity of the hem in world space (x along the rail, z toward the viewer)
    const vx = h.vx + HEM_L * Math.cos(h.ph) * h.phv;
    const vz = -HEM_L * Math.cos(h.th) * h.thv;
    const tx = THREE.MathUtils.clamp(-vx * 0.06, -0.16, 0.16);
    const tz = THREE.MathUtils.clamp(-vz * 0.06, -0.16, 0.16);
    // second-order follow so the fabric overshoots and wobbles
    const W = 9, Z = 0.28;
    h.lagv.x += (W * W * (tx - h.lag.x) - 2 * Z * W * h.lagv.x) * dt;
    h.lagv.y += (W * W * (tz - h.lag.y) - 2 * Z * W * h.lagv.y) * dt;
    h.lag.x += h.lagv.x * dt; h.lag.y += h.lagv.y * dt;

    // world → shirt-local (rotate by −yaw around y)
    const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
    const u = h.shirt.uniforms;
    u.uLag.value.set(h.lag.x * c - h.lag.y * s, h.lag.x * s + h.lag.y * c);
    const speed = Math.hypot(h.lagv.x, h.lagv.y);
    const fl = Math.min(0.011, 0.0012 + speed * 0.012);
    h.flutter += (fl - h.flutter) * Math.min(1, dt * 6);
    u.uFlutter.value = h.flutter;
    u.uTime.value = t;
    poseHanger(h);
  }
}

/* ================================================================== */
/*  Camera                                                             */
/* ================================================================== */

const camPos = new THREE.Vector3(0, 1.0, 5);
const camTgt = new THREE.Vector3(0, 0.9, 0);
let camInit = false;
const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

function layoutMetrics() {
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 0.85;
  // browse: fit the rail, but never get absurdly far on phones
  const fitDist = (SPACING * (N - 1) / 2 + 0.44 * SCALE) / (tanHalf * aspect);
  const distB = Math.min(portrait ? 5.2 : 8, Math.max(3.1, fitDist));
  const visHalfW = distB * tanHalf * aspect;
  const panRange = Math.max(0, SPACING * (N - 1) / 2 + 0.3 - visHalfW);
  // detail
  const distD = SCALE * Math.max(2.1, 1.02 / (2 * tanHalf * aspect));
  return { aspect, portrait, distB, visHalfW, panRange, distD };
}

function updateCamera(dt) {
  const m = layoutMetrics();
  // ease browse params
  const k = 1 - Math.exp(-dt * 7);
  state.orbitYaw += (state.orbitYawT - state.orbitYaw) * k;
  state.orbitPitch += (state.orbitPitchT - state.orbitPitch) * k;
  state.panXT = THREE.MathUtils.clamp(state.panXT, -m.panRange, m.panRange);
  state.panX += (state.panXT - state.panX) * k;

  const par = pointer.nx * 0.07;
  const yawE = state.orbitYaw + par;
  const pitE = state.orbitPitch - pointer.ny * 0.03;
  const bp = new THREE.Vector3(
    state.panX + Math.sin(yawE) * Math.cos(pitE) * m.distB,
    RAIL_Y - 0.347 * SCALE + Math.sin(pitE) * m.distB,
    Math.cos(yawE) * Math.cos(pitE) * m.distB
  );
  const bt = new THREE.Vector3(state.panX, RAIL_Y - 0.347 * SCALE, 0);

  const visH = 2 * m.distD * tanHalf;
  const dpos = new THREE.Vector3(0 + (m.portrait ? 0 : -0.0), 0.92, m.distD);
  const dtg = new THREE.Vector3(
    m.portrait ? 0 : -visH * m.aspect * 0.07,
    RAIL_Y - 0.387 * SCALE - visH * (m.portrait ? 0.12 : 0.0),
    0
  );
  dpos.x = dtg.x; dpos.y = dtg.y;

  const target = state.mode === 'detail' ? 1 : 0;
  state.detailMix += (target - state.detailMix) * (1 - Math.exp(-dt * 4.2));
  const e = state.detailMix * state.detailMix * (3 - 2 * state.detailMix);

  const wantPos = bp.lerp(dpos, e);
  const wantTgt = bt.lerp(dtg, e);
  if (!camInit) { camPos.copy(wantPos); camTgt.copy(wantTgt); camInit = true; }
  camPos.copy(wantPos); camTgt.copy(wantTgt);
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
  return m;
}

/* ================================================================== */
/*  Pointer interaction                                                */
/* ================================================================== */

const pointer = { x: 0, y: 0, nx: 0, ny: 0, vx: 0, vy: 0, inside: false, moved: false };
const down = { active: false, id: -1, sx: 0, sy: 0, lx: 0, ly: 0, drag: false, hit: null, mode: null };
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tag = document.getElementById('tag');
const hintEl = document.getElementById('hint');

function pick(px, py) {
  ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, false);
  return hits.length ? hits[0] : null;
}

function beginGrab(hit) {
  const h = hangers[hit.object.userData.shirtIndex];
  poseHanger(h);
  h.shirt.root.updateMatrixWorld(true);
  grab.h = h;
  grab.local.copy(hit.point);
  h.shirt.yaw.worldToLocal(grab.local);
  grab.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tmpV).clone().negate(), hit.point);
  grab.target.copy(hit.point);
  h.grabbed = true;
}
function endGrab() {
  if (grab.h) { grab.h.grabbed = false; grab.h.f.set(0, 0, 0); grab.h.fp = null; }
  grab.h = null;
}
function updateGrabTarget() {
  ndc.set((pointer.x / window.innerWidth) * 2 - 1, -(pointer.y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (ray.ray.intersectPlane(grab.plane, p)) grab.target.copy(p);
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointer.x = e.clientX; pointer.y = e.clientY;
  down.active = true; down.id = e.pointerId; down.sx = down.lx = e.clientX; down.sy = down.ly = e.clientY;
  down.drag = false; down.hit = pick(e.clientX, e.clientY); down.mode = null;
  hideHint();
});

canvas.addEventListener('pointermove', (e) => {
  const nx = e.clientX, ny = e.clientY;
  pointer.vx = nx - pointer.x; pointer.vy = ny - pointer.y;
  pointer.x = nx; pointer.y = ny;
  pointer.nx = (nx / window.innerWidth) * 2 - 1;
  pointer.ny = (ny / window.innerHeight) * 2 - 1;
  pointer.inside = true; pointer.moved = true;

  if (!down.active) return;
  const dx = nx - down.lx, dy = ny - down.ly;
  if (!down.drag && Math.hypot(nx - down.sx, ny - down.sy) > 6) {
    down.drag = true;
    if (state.mode === 'detail') {
      down.mode = 'spin';
      const h = hangers[state.sel]; h.spinning = true; h.yawv = 0;
    } else if (down.hit) {
      down.mode = 'grab';
      beginGrab(down.hit);
    } else down.mode = 'orbit';
    canvas.classList.add('dragging');
  }
  if (!down.drag) return;

  if (down.mode === 'spin') {
    const h = hangers[state.sel];
    h.yaw += dx * 0.012;
    h.yawv = dx * 0.012 * 60;
  } else if (down.mode === 'orbit') {
    const m = layoutMetrics();
    if (m.panRange > 0) {
      const worldPerPx = (2 * m.visHalfW) / window.innerWidth;
      state.panXT -= dx * worldPerPx;
    } else {
      state.orbitYawT = THREE.MathUtils.clamp(state.orbitYawT + dx * 0.004, -0.95, 0.95);
      state.orbitPitchT = THREE.MathUtils.clamp(state.orbitPitchT + dy * 0.002, -0.12, 0.3);
    }
  }
  down.lx = nx; down.ly = ny;
});

function release(e) {
  if (!down.active) return;
  down.active = false;
  canvas.classList.remove('dragging');
  if (down.mode === 'grab') endGrab();
  if (down.mode === 'spin') {
    const h = hangers[state.sel];
    h.spinning = false;
    const predicted = h.yaw + h.yawv * 0.22;
    h.yawTarget = Math.round(predicted / Math.PI) * Math.PI;
    syncViewButtons();
  }
  if (!down.drag && e.type === 'pointerup' && state.mode === 'browse' && down.hit) {
    openDetail(down.hit.object.userData.shirtIndex);
  }
  down.hit = null; down.mode = null;
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });

/* ================================================================== */
/*  UI                                                                 */
/* ================================================================== */

const $ = (s) => document.querySelector(s);
const ui = {
  detail: $('#detail'), idx: $('#d-index'), name: $('#d-name'), price: $('#d-price'), desc: $('#d-desc'),
  color: $('#d-color'), swatch: $('#d-swatch'), bag: $('#bag-count'), add: $('#d-add'),
  sizes: [...document.querySelectorAll('.size')], views: [...document.querySelectorAll('[data-view]')],
};
let bag = 0;
let size = 'M';

function hideHint() { hintEl.classList.add('gone'); }

function fillDetail(i) {
  const p = PRODUCTS[i];
  ui.idx.textContent = `${p.id} / ${String(N).padStart(2, '0')}`;
  ui.name.textContent = p.name;
  ui.price.textContent = `$${p.price}`;
  ui.desc.textContent = p.desc;
  ui.color.textContent = p.colorName;
  ui.swatch.style.background = p.color;
}

function viewTarget(h, front) {
  return front
    ? Math.round(h.yaw / TAU) * TAU
    : Math.round((h.yaw - Math.PI) / TAU) * TAU + Math.PI;
}
function isFront(h) {
  return Math.abs(Math.round(h.yawTarget / Math.PI)) % 2 === 0;
}
function syncViewButtons() {
  if (state.sel < 0) return;
  const front = isFront(hangers[state.sel]);
  ui.views.forEach((b) => {
    const on = (b.dataset.view === 'front') === front;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  });
}

function openDetail(i) {
  endGrab();
  state.mode = 'detail';
  state.sel = i;
  hangers.forEach((h) => {
    if (h.i === i) h.yawTarget = viewTarget(h, true);
    else h.yawTarget = h.restYaw + TAU * Math.round((h.yaw - h.restYaw) / TAU);
  });
  setHomes();
  fillDetail(i);
  syncViewButtons();
  document.body.classList.add('is-detail');
  ui.detail.setAttribute('aria-hidden', 'false');
  tag.classList.remove('show');
  // a little tug as it is lifted
  hangers[i].thv += 1.2;
}

function closeDetail() {
  if (state.mode !== 'detail') return;
  const h = hangers[state.sel];
  h.spinning = false;
  state.mode = 'browse';
  hangers.forEach((g) => { g.yawTarget = g.restYaw + TAU * Math.round((g.yaw - g.restYaw) / TAU); });
  setHomes();
  state.sel = -1;
  document.body.classList.remove('is-detail');
  ui.detail.setAttribute('aria-hidden', 'true');
}

function step(dir) {
  if (state.mode !== 'detail') return;
  const next = (state.sel + dir + N) % N;
  if (Math.abs(next - state.sel) > 1) { // wrap-around: just jump without sliding across the whole rail
    state.sel = next;
  } else state.sel = next;
  hangers.forEach((h) => {
    if (h.i === state.sel) h.yawTarget = viewTarget(h, true);
    else h.yawTarget = h.restYaw + TAU * Math.round((h.yaw - h.restYaw) / TAU);
  });
  setHomes();
  fillDetail(state.sel);
  syncViewButtons();
}

$('#d-close').addEventListener('click', closeDetail);
$('#d-prev').addEventListener('click', () => step(-1));
$('#d-next').addEventListener('click', () => step(1));
ui.views.forEach((b) => b.addEventListener('click', () => {
  if (state.sel < 0) return;
  const h = hangers[state.sel];
  h.spinning = false;
  h.yawTarget = viewTarget(h, b.dataset.view === 'front');
  syncViewButtons();
}));
ui.sizes.forEach((b) => b.addEventListener('click', () => {
  size = b.dataset.size;
  ui.sizes.forEach((s) => s.classList.toggle('on', s === b));
}));
ui.add.addEventListener('click', () => {
  bag += 1; ui.bag.textContent = bag;
  ui.add.textContent = 'Added ✓';
  setTimeout(() => { ui.add.textContent = 'Add to bag'; }, 1200);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDetail();
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
});

/* ================================================================== */
/*  Hover (label + brush the hangers with the cursor)                  */
/* ================================================================== */

const brushV = new THREE.Vector3();
const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();

function updateHover(dt) {
  for (const h of hangers) if (!h.grabbed) { h.f.set(0, 0, 0); h.fp = null; }

  if (state.mode !== 'browse' || down.active || !pointer.inside) {
    state.hover = -1; tag.classList.remove('show'); canvas.style.cursor = ''; return;
  }
  const hit = pick(pointer.x, pointer.y);
  if (!hit) { state.hover = -1; tag.classList.remove('show'); canvas.style.cursor = ''; return; }
  const i = hit.object.userData.shirtIndex;
  state.hover = i;
  canvas.style.cursor = 'grab';
  const p = PRODUCTS[i];
  tag.innerHTML = `<b>${p.name}</b><span>$${p.price}</span>`;
  tag.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 16}px)`;
  tag.classList.add('show');

  // cursor sweeping across a shirt nudges it, like brushing past clothes on a rack
  const speed = Math.hypot(pointer.vx, pointer.vy);
  if (speed > 1.5) {
    camera.matrixWorld.extractBasis(camRight, camUp, camFwd);
    const dist = camera.position.distanceTo(hit.point);
    const pxToWorld = (2 * dist * tanHalf) / window.innerHeight;
    const k = Math.min(1, 40 / speed);
    const per = pxToWorld / Math.max(dt, 1 / 120);
    brushV.copy(camRight).multiplyScalar(pointer.vx * k * per).addScaledVector(camUp, -pointer.vy * k * per);
    const h = hangers[i];
    h.f.copy(brushV).multiplyScalar(0.9);
    if (h.f.length() > 9) h.f.setLength(9);
    h.fp = hit.point.clone();
  }
  pointer.vx *= 0.5; pointer.vy *= 0.5;
}

/* ================================================================== */
/*  Resize / loop                                                      */
/* ================================================================== */

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let acc = 0;
let physT = 0;
let firstFrame = true;

function simulate(dt) {
  if (grab.h) updateGrabTarget();
  acc += dt;
  while (acc >= STEP) {
    physicsStep(STEP, physT);
    physT += STEP; acc -= STEP;
  }
  updateCloth(dt, state.time);
  updateCamera(dt);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.time += dt;

  updateHover(dt);
  simulate(dt);

  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    document.body.classList.add('ready');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small hook for tests / debugging
window.__atelier = {
  open: openDetail, close: closeDetail, state, hangers, step,
  // advance the simulation without rendering (used by tests on slow software GL)
  screenOf(i) {
    const v = new THREE.Vector3(0, -0.3, 0);
    hangers[i].shirt.yaw.localToWorld(v);
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  },
  snapshot() { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
  advance(sec) { for (let t = 0; t < sec; t += 1 / 60) { state.time += 1 / 60; simulate(1 / 60); } },
};
