import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { makePrintTexture } from './designs.js';

export const SHIRT_H = 0.70; // hem -> neck, metres
export const HOOK_R = 0.0165; // radius of the hook loop that wraps the rail
export const HANGER_DROP = 0.075; // rail centre -> hanger arms (neck)

/*
 * The garment itself is a real asset: assets/tees.glb, produced by tools/build-tees.mjs.
 * It is a t-shirt cut from pattern pieces (front, back, two sleeves) sewn along welded seams
 * and draped on this hanger by a cloth simulation. Shirt space: metres, y up, hem at y = 0.
 */
const ARM_R = 0.0085; // hanger arm half thickness
const ARM_HALF = 0.205; // hanger arm length from the neck
const ARM_SLOPE = 0.045 / (0.225 - 0.092); // arms follow the shoulder seam
const ARM_TOP_Y = 0.7271; // arm top at the neck, in shirt space

/* ---------- load the baked garments ---------- */

export async function loadTees(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
  return gltf.scene.children.map((node) => {
    const meshes = [];
    node.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const [cloth, rib] = meshes.map((m) => m.geometry);
    [cloth, rib].forEach((g) => {
      const pos = g.attributes.position, aH = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) aH[i] = Math.min(1, Math.max(0, 1 - pos.getY(i) / SHIRT_H));
      g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
    });
    return { cloth, rib };
  });
}

/* ---------- hanger ---------- */

function buildHanger() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#cdb892', roughness: 0.5, metalness: 0.0 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c6c9ce', roughness: 0.28, metalness: 1.0 });

  // two straight arms that follow the shoulder seam; thickness matches the collider used in the simulation
  const thick = ARM_R * 2;
  const top = (x) => -ARM_SLOPE * Math.abs(x);
  const shape = new THREE.Shape();
  shape.moveTo(-ARM_HALF, top(-ARM_HALF));
  shape.lineTo(0, 0);
  shape.lineTo(ARM_HALF, top(ARM_HALF));
  shape.absarc(ARM_HALF, top(ARM_HALF) - ARM_R, ARM_R, Math.PI / 2, -Math.PI / 2, true);
  shape.lineTo(0, -thick);
  shape.lineTo(-ARM_HALF, top(-ARM_HALF) - thick);
  shape.absarc(-ARM_HALF, top(-ARM_HALF) - ARM_R, ARM_R, -Math.PI / 2, -Math.PI * 1.5, true);
  const arms = new THREE.ExtrudeGeometry(shape, {
    depth: 0.011, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0025, bevelSegments: 3, curveSegments: 14,
  });
  arms.translate(0, 0, -0.0055);
  const armsMesh = new THREE.Mesh(arms, wood);
  armsMesh.castShadow = true;
  group.add(armsMesh);

  // neck block + stem (rises through the neckline)
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.018, 20), wood);
  block.position.y = -0.004; block.castShadow = true;
  group.add(block);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.06, 12), metal);
  stem.position.y = 0.03;
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

export function createShirt(product, index, fabricBump, maxAniso, tee) {
  const uniforms = { uLag: { value: new THREE.Vector2() }, uFlutter: { value: 0 }, uTime: { value: 0 } };

  const printTex = makePrintTexture(product, maxAniso);
  const bump = fabricBump.clone(); bump.needsUpdate = true; bump.repeat.set(260, 155);

  const col = new THREE.Color(product.color);
  const sheen = col.clone().lerp(new THREE.Color('#ffffff'), 0.55);
  const common = {
    roughness: 0.42, metalness: 0, sheen: 1, sheenRoughness: 0.28, sheenColor: sheen,
    clearcoat: 0.1, clearcoatRoughness: 0.4, side: THREE.DoubleSide,
  };
  const clothMat = new THREE.MeshPhysicalMaterial({ ...common, map: printTex, bumpMap: bump, bumpScale: 0.25 });
  const ribMat = new THREE.MeshPhysicalMaterial({ ...common, sheen: 0.3, color: col.clone().multiplyScalar(0.93) });
  [clothMat, ribMat].forEach((m) => patchDisplace(m, uniforms, true));

  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  patchDisplace(depthMat, uniforms, false);

  const shirt = new THREE.Group();
  const mk = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = depthMat;
    shirt.add(m);
    return m;
  };
  const cloth = mk(tee.cloth, clothMat);
  mk(tee.rib, ribMat);
  shirt.position.y = -ARM_TOP_Y;

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

  const pickables = [cloth, hanger.yawPart.children[0]];
  pickables.forEach((m) => { m.userData.shirtIndex = index; });

  return { root, swing, yaw, shirt, uniforms, pickables, product };
}
