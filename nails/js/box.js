import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { makeBoxLabel, makeNailMaterial } from './designs.js';
import { trayNailGeometry } from './nail.js';

/*
 * A crystal-clear acrylic nail case (86 x 92 x 20 mm): a base tray with very round corners, a clear lid
 * hinged on the left that really opens, snap latches top and bottom, a clear hang tab and a small paper
 * sticker. The nails lie on the clear floor and are visible from outside.
 *
 * Clear plastic is drawn as two layers on every part: a barely-there cool tint, plus an additive
 * "gloss" layer that carries only the reflections, so highlights stay bright however transparent it is.
 */
export const BOX = { W: 0.086, H: 0.092, HOLE_Y: 0.0565, HOLE_Z: -0.0097, FRONT: 0.0093 };
const Z = { back: -0.0105, floorTop: -0.0089, baseTop: 0.0028, lidTop: 0.0093 };
const R = 0.011; // corner radius
const WALL = 0.0019;

function rr(w, h, r, cx = 0, cy = 0, Klass = THREE.Shape) {
  const s = new Klass(); const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

function extrude(shape, depth, z0, bevel = 0.0004) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.0001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 18 });
  g.translate(0, 0, z0 + bevel);
  return g;
}

let clearTint, clearGloss;
function clearMaterials() {
  if (!clearTint) {
    clearTint = new THREE.MeshPhysicalMaterial({ color: '#d9e9f2', transparent: true, opacity: 0.07, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
    clearGloss = new THREE.MeshPhysicalMaterial({
      color: '#000000', roughness: 0.035, metalness: 0, specularIntensity: 1, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.02,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
    });
    // a flat clear face can mirror a very bright patch of the studio: cap the reflection so it never blows out
    clearGloss.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = min(outgoingLight * 0.45, vec3(0.04));\n#include <opaque_fragment>');
    };
    clearGloss.customProgramCacheKey = () => 'clear-gloss';
  }
  return { tint: clearTint, gloss: clearGloss };
}

export function createBox(product, maxAniso = 8) {
  const { W, H } = BOX;
  const { tint, gloss } = clearMaterials();
  const body = new THREE.Group();
  const meshes = [];
  /** a clear part: tint layer (also the pickable) + additive reflection layer */
  const clear = (parent, geo) => {
    const a = new THREE.Mesh(geo, tint); a.renderOrder = 2; parent.add(a); meshes.push(a);
    const b = new THREE.Mesh(geo, gloss); b.renderOrder = 3; parent.add(b);
    return a;
  };

  // base: floor, wall ring, hang tab
  clear(body, extrude(rr(W, H, R), 0.0018, Z.back));
  const ring = rr(W, H, R);
  ring.holes.push(rr(W - WALL * 2, H - WALL * 2, R - WALL, 0, 0, THREE.Path));
  clear(body, extrude(ring, Z.baseTop - Z.back, Z.back));
  const tab = rr(0.034, 0.030, 0.0095, 0, BOX.HOLE_Y - 0.0035);
  const hole = new THREE.Path(); hole.absarc(0, BOX.HOLE_Y, 0.0044, 0, Math.PI * 2, true);
  tab.holes.push(hole);
  clear(body, extrude(tab, 0.0018, Z.back));
  // base latch catches (top and bottom)
  for (const sy of [1, -1]) {
    const cat = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0032, 0.0034), gloss);
    cat.position.set(0, sy * (H / 2 + 0.0008), Z.baseTop - 0.0018); body.add(cat);
  }

  // the nails lie on the clear floor
  const nailMat = makeNailMaterial(product, maxAniso, 1.1);
  const nails = new THREE.Mesh(trayNailGeometry(product.shape, product.length, mergeGeometries), nailMat);
  nails.position.set(0, 0, Z.floorTop + 0.0002);
  nails.castShadow = true; nails.receiveShadow = true;
  body.add(nails);

  // lid, hinged on the left
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-W / 2, 0, 0);
  body.add(lidPivot);
  const lid = new THREE.Group();
  lid.position.x = W / 2;
  lidPivot.add(lid);
  clear(lid, extrude(rr(W, H, R), 0.0018, Z.lidTop - 0.0018));
  const lidRing = rr(W, H, R);
  lidRing.holes.push(rr(W - WALL * 2, H - WALL * 2, R - WALL, 0, 0, THREE.Path));
  clear(lid, extrude(lidRing, Z.lidTop - Z.baseTop - 0.0010, Z.baseTop));
  for (const sy of [1, -1]) { // snap tabs on the lid
    const sn = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.0042, 0.0030), gloss);
    sn.position.set(0, sy * (H / 2 + 0.0004), Z.baseTop + 0.0024); lid.add(sn);
  }
  // paper sticker
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.034, 0.0106),
    new THREE.MeshStandardMaterial({ map: makeBoxLabel(product), roughness: 0.55 })
  );
  label.material.map.anisotropy = maxAniso;
  label.position.set(-W / 2 + 0.0255, -H / 2 + 0.0135, Z.lidTop + 0.0002);
  lid.add(label);

  // peg-relative frame: the origin of `root` is the centre of the hang hole
  const root = new THREE.Group();
  const swing = new THREE.Group();
  const tilt = new THREE.Group();
  const yaw = new THREE.Group();
  root.add(swing); swing.add(tilt); tilt.add(yaw); yaw.add(body);
  body.position.set(0, -BOX.HOLE_Y, -BOX.HOLE_Z);

  return {
    root, swing, tilt, yaw, body, lidPivot, nails, meshes, product, nailMat,
    setOpen(a) { lidPivot.rotation.y = -a; },
    setTray(shape, length) { nails.geometry.dispose(); nails.geometry = trayNailGeometry(shape, length, mergeGeometries); },
  };
}
