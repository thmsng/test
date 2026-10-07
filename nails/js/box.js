import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { makeBoxFront, makeBoxBack, makeNailMaterial, shade } from './designs.js';
import { trayNailGeometry } from './nail.js';

/*
 * A hang-sell press-on nail box (real size: 70 x 130 x 22 mm).
 * Parts: back plate with a euro-slot hang tab, a wall ring, a velvet insert holding the nails,
 * and a printed lid with a window that is hinged on the left and really opens.
 */
export const BOX = { W: 0.070, H: 0.130, HOLE_Y: 0.074, HOLE_Z: -0.0099 };
const Z = { back: -0.0110, floor: -0.0088, lid: 0.0088, front: 0.0110 };
const WIN = { w: 0.050, h: 0.075, cy: 0.010 };

function rr(w, h, r, cx = 0, cy = 0, Klass = THREE.Shape) {
  const s = new Klass(); const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

function extrude(shape, depth, z0, bevel = 0.0004) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 14 });
  g.translate(0, 0, z0 + bevel);
  return g;
}

/** front caps get one material, back caps another, everything else a third */
function splitCaps(g) {
  const pos = g.attributes.position;
  const front = [], back = [], side = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const nz = b.clone().sub(a).cross(c.clone().sub(a)).normalize().z;
    (nz > 0.9 ? front : nz < -0.9 ? back : side).push(i, i + 1, i + 2);
  }
  g.setIndex([...front, ...back, ...side]);
  g.clearGroups();
  g.addGroup(0, front.length, 0); g.addGroup(front.length, back.length, 1); g.addGroup(front.length + back.length, side.length, 2);
}

function planarUV(g) {
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) + BOX.W / 2) / BOX.W; uv[i * 2 + 1] = (pos.getY(i) + BOX.H / 2) / BOX.H; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function createBox(product, maxAniso = 8) {
  const { W, H } = BOX;
  const plastic = new THREE.MeshPhysicalMaterial({ color: shade(product.tone, -0.025), roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const velvet = new THREE.MeshPhysicalMaterial({ color: shade(product.tone, 0.035), roughness: 0.92, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(product.accent) });
  const printed = new THREE.MeshPhysicalMaterial({ map: makeBoxFront(product), roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.22 });
  const inner = new THREE.MeshPhysicalMaterial({ map: makeBoxBack(product), roughness: 0.6 });
  [printed.map, inner.map].forEach((t) => { t.anisotropy = maxAniso; });

  const body = new THREE.Group();
  const meshes = [];
  const add = (parent, geo, mat, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); meshes.push(m); return m;
  };

  // back plate + hang tab (one piece)
  const plate = rr(W, H, 0.006);
  const tab = rr(0.034, 0.030, 0.009, 0, H / 2 + 0.0095 - 0.0, THREE.Path);
  const plateGeo = extrude(plate, Z.floor - Z.back, Z.back, 0.0003);
  add(body, plateGeo, plastic);
  const tabShape = rr(0.034, 0.030, 0.009, 0, BOX.HOLE_Y + 0.001);
  const hole = new THREE.Path(); hole.absarc(0, BOX.HOLE_Y, 0.0044, 0, Math.PI * 2, true);
  tabShape.holes.push(hole);
  add(body, extrude(tabShape, Z.floor - Z.back, Z.back, 0.0003), plastic);
  void tab;

  // wall ring
  const ring = rr(W, H, 0.006);
  ring.holes.push(rr(W - 0.0046, H - 0.0046, 0.0042, 0, 0, THREE.Path));
  add(body, extrude(ring, Z.lid - Z.back, Z.back, 0.0003), plastic);

  // insert that the nails sit on
  const insert = rr(W - 0.0052, H - 0.0052, 0.004);
  add(body, extrude(insert, 0.0118, Z.floor, 0), velvet, false);

  // nails
  const nailMat = makeNailMaterial(product, maxAniso, 1.1);
  const trayGeo = trayNailGeometry(product.shape, product.length, mergeGeometries);
  const nails = new THREE.Mesh(trayGeo, nailMat);
  nails.position.set(0, WIN.cy, Z.floor + 0.0118 + 0.0004);
  nails.castShadow = false; nails.receiveShadow = true;
  body.add(nails);

  // lid, hinged on the left
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-W / 2, 0, 0);
  body.add(lidPivot);
  const lid = rr(W, H, 0.006);
  lid.holes.push(rr(WIN.w, WIN.h, 0.004, 0, WIN.cy, THREE.Path));
  const lidGeo = extrude(lid, Z.front - Z.lid, Z.lid, 0.0003);
  planarUV(lidGeo);
  splitCaps(lidGeo);
  const lidMesh = new THREE.Mesh(lidGeo, [printed, inner, plastic]);
  lidMesh.position.x = W / 2;
  lidMesh.castShadow = true; lidMesh.receiveShadow = true;
  lidPivot.add(lidMesh); meshes.push(lidMesh);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(WIN.w + 0.002, WIN.h + 0.002),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide })
  );
  glass.position.set(W / 2, WIN.cy, Z.lid - 0.0002);
  lidPivot.add(glass);

  // peg-relative frame: the origin of `root` is the centre of the hang hole
  const root = new THREE.Group();
  const swing = new THREE.Group();
  const tilt = new THREE.Group();
  const yaw = new THREE.Group();
  root.add(swing); swing.add(tilt); tilt.add(yaw); yaw.add(body);
  body.position.set(0, -BOX.HOLE_Y, -BOX.HOLE_Z);

  meshes.forEach((m) => { m.userData.boxIndex = -1; });

  return {
    root, swing, tilt, yaw, body, lidPivot, nails, meshes, product, nailMat,
    setOpen(a) { lidPivot.rotation.y = -a; },
    setTray(shape, length) { nails.geometry.dispose(); nails.geometry = trayNailGeometry(shape, length, mergeGeometries); },
  };
}
