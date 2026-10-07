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

/*
 * Skin. The baked vertex colours carry ambient occlusion, blush over knuckles and fingertips, and
 * wrinkles over the finger joints; the vertex alpha says how thin the flesh is there. The shader adds
 * fine procedural pores and a cheap subsurface glow (red light bleeding through thin skin at grazing angles).
 */
export function makeSkinMaterial(color) {
  const m = new THREE.MeshPhysicalMaterial({
    color, vertexColors: true, roughness: 0.6, specularIntensity: 0.65,
    sheen: 0.55, sheenColor: new THREE.Color('#ffa592'), sheenRoughness: 0.5,
    clearcoat: 0.04, clearcoatRoughness: 0.6,
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObjPos;
        float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        float vnoise(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // fine skin texture: pores plus softer undulation, as a bump on the shading normal
          float hgt = vnoise(vObjPos * 1300.0) * 0.55 + vnoise(vObjPos * 380.0) * 0.45;
          vec2 dH = vec2(dFdx(hgt), dFdy(hgt)) * 0.0002;
          vec3 sX = dFdx(-vViewPosition), sY = dFdy(-vViewPosition);
          vec3 R1 = cross(sY, normal), R2 = cross(normal, sX);
          float det = dot(sX, R1) * faceDirection;
          vec3 grad = sign(det) * (dH.x * R1 + dH.y * R2);
          normal = normalize(abs(det) * normal - grad);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float thinSkin = vColor.a;
          float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.2);
          totalEmissiveRadiance += vec3(0.62, 0.15, 0.09) * thinSkin * (0.22 + 0.85 * fres) * 0.2;
        }`);
  };
  m.customProgramCacheKey = () => 'skin-v2';
  return m;
}

export function setSkin(material, color) { material.color.set(color); }
