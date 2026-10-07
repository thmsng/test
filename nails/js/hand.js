import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';

/** Loads assets/hands.glb: the half-folded try-on hand and the pointing hand used as the cursor. */
export async function loadHands(url) {
  let buf;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    buf = await res.arrayBuffer();
  } catch {
    const b64 = (await (await fetch(url + '.b64.txt')).text()).trim(); // text-only hosts
    buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  }
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
  const nails = gltf.parser.json.asset.extras.nails;
  const out = {};
  for (const node of gltf.scene.children) {
    let geometry;
    node.traverse((o) => { if (o.isMesh) geometry = o.geometry; });
    out[node.name] = { geometry, nails: nails[node.name] };
  }
  return out;
}

export function makeSkinMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, vertexColors: true, roughness: 0.56,
    sheen: 0.7, sheenColor: new THREE.Color('#ff9f8c'), sheenRoughness: 0.55,
    clearcoat: 0.05, clearcoatRoughness: 0.55,
  });
}

export function setSkin(material, color) { material.color.set(color); }
