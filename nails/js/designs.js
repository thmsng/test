import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Catalogue                                                          */
/* ------------------------------------------------------------------ */

export const PRODUCTS = [
  {
    id: '01', name: 'Milk Bath', price: 18, tone: '#efcdcf', ink: '#4a3436', accent: '#e8b8b6', shape: 'almond', length: 1,
    finish: 'Sheer · Pearl', paint: 'milk', mat: { roughness: 0.18, metalness: 0, clearcoat: 1 },
    desc: 'A soft, milky pink with a drift of pearl. The kind of clean, "your nails but better" manicure that goes with everything.',
  },
  {
    id: '02', name: 'Lemon Lily', price: 24, tone: '#f2e3a6', ink: '#4d4210', accent: '#f1cc22', shape: 'almond', length: 2,
    finish: 'Gloss · French', paint: 'french', tip: '#f4cf12', flower: true, mat: { roughness: 0.05, metalness: 0, clearcoat: 1 },
    desc: 'A glossy nude base with sunny yellow French tips, and a hand-sculpted 3D lily on the ring finger.',
  },
  {
    id: '03', name: 'Cherry Gloss', price: 20, tone: '#e6b5b0', ink: '#5b0f19', accent: '#a3121f', shape: 'coffin', length: 1,
    finish: 'High gloss · Red', paint: 'cherry', mat: { roughness: 0.06, metalness: 0, clearcoat: 1 },
    desc: 'Deep, wet-look cherry red in a short coffin shape. Bold without trying too hard.',
  },
  {
    id: '04', name: 'Chrome Aura', price: 24, tone: '#cdd3e4', ink: '#2c3140', accent: '#c8cee0', shape: 'almond', length: 2,
    finish: 'Mirror · Chrome', paint: 'chrome', mat: { roughness: 0.07, metalness: 1, clearcoat: 0.6 },
    desc: 'Liquid-metal chrome that flips between pearl pink and icy blue as your hand moves.',
  },
  {
    id: '05', name: 'Midnight Cat-Eye', price: 22, tone: '#b6bfdf', ink: '#0d1430', accent: '#18254d', shape: 'almond', length: 1,
    finish: 'Magnetic · Navy', paint: 'cateye', mat: { roughness: 0.1, metalness: 0.55, clearcoat: 1 },
    desc: 'A deep navy base with a shimmering magnetic streak that shifts with the light.',
  },
  {
    id: '06', name: 'Rose Marble', price: 22, tone: '#eecbcb', ink: '#5a3a3c', accent: '#d9a3a4', shape: 'square', length: 1,
    finish: 'Gloss · Marble', paint: 'marble', mat: { roughness: 0.1, metalness: 0, clearcoat: 1 },
    desc: 'Swirls of blush and rose with hairline gold veins, on a short, square nail.',
  },
  {
    id: '07', name: 'Matcha Matte', price: 18, tone: '#cbdac2', ink: '#2f3d2b', accent: '#9db391', shape: 'oval', length: 1,
    finish: 'Matte · Sage', paint: 'matcha', mat: { roughness: 0.62, metalness: 0, clearcoat: 0.0 },
    desc: 'A calm, velvety sage with tiny cream flecks. Soft to look at, smooth to the touch.',
  },
  {
    id: '08', name: 'Golden Hour', price: 24, tone: '#efcc9b', ink: '#5a3b16', accent: '#e8b14e', shape: 'stiletto', length: 2,
    finish: 'Glitter · Ombré', paint: 'golden', mat: { roughness: 0.12, metalness: 0.2, clearcoat: 1 },
    desc: 'Peach melts into liquid gold glitter at the tip. A long stiletto made for sunsets.',
  },
];

export const SKIN_TONES = [
  { name: 'Porcelain', color: '#f0c9b6' },
  { name: 'Sand', color: '#e0ad8f' },
  { name: 'Honey', color: '#c58b65' },
  { name: 'Cocoa', color: '#8a5a3f' },
];

export const SHAPES = [
  { id: 'almond', label: 'Almond' },
  { id: 'coffin', label: 'Coffin' },
  { id: 'square', label: 'Square' },
  { id: 'stiletto', label: 'Stiletto' },
];

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ------------------------------------------------------------------ */
/*  nail art (256 x 512; the cuticle is at the BOTTOM, the free edge at the top)  */
/* ------------------------------------------------------------------ */

const NW = 256, NH = 512;

const PAINT = {
  milk(ctx, r) {
    const g = ctx.createLinearGradient(0, NH, 0, 0);
    g.addColorStop(0, '#efd3d3'); g.addColorStop(0.6, '#f6e6e4'); g.addColorStop(1, '#fbf2ef');
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 700; i++) { ctx.fillStyle = r() > 0.5 ? '#ffffff' : '#f2c9d2'; ctx.fillRect(r() * NW, r() * NH, 1 + r() * 1.6, 1 + r() * 1.6); }
    ctx.globalAlpha = 1;
    const s = ctx.createLinearGradient(40, 0, 130, 0);
    s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.35)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.fillRect(40, 60, 90, 400);
  },
  french(ctx, r, p) {
    const g = ctx.createLinearGradient(0, NH, 0, 0);
    g.addColorStop(0, '#d2a28c'); g.addColorStop(1, '#dab09a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    ctx.fillStyle = (p && p.tip) || '#fbf8f4';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(NW, 0); ctx.lineTo(NW, 112);
    ctx.quadraticCurveTo(NW / 2, 205, 0, 112); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 300; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(r() * NW, r() * NH, 1.2, 1.2); }
    ctx.globalAlpha = 1;
  },
  cherry(ctx) {
    const g = ctx.createRadialGradient(NW * 0.4, NH * 0.5, 20, NW / 2, NH / 2, NH * 0.62);
    g.addColorStop(0, '#c4202f'); g.addColorStop(0.6, '#9a111e'); g.addColorStop(1, '#6a0912');
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
  },
  chrome(ctx, r) {
    const g = ctx.createLinearGradient(0, NH, NW, 0);
    g.addColorStop(0, '#e9eaf2'); g.addColorStop(0.3, '#f6d4e6'); g.addColorStop(0.55, '#cfe0ff'); g.addColorStop(0.8, '#e7d6f6'); g.addColorStop(1, '#f4f6fb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'blur(10px)';
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = ['rgba(255,170,215,0.35)', 'rgba(150,200,255,0.4)', 'rgba(255,255,255,0.5)'][i % 3];
      ctx.lineWidth = 18 + r() * 24; ctx.beginPath(); ctx.moveTo(-20, r() * NH); ctx.bezierCurveTo(80, r() * NH, 170, r() * NH, NW + 20, r() * NH); ctx.stroke();
    }
    ctx.filter = 'none';
  },
  cateye(ctx, r) {
    const g = ctx.createLinearGradient(0, 0, NW, NH);
    g.addColorStop(0, '#16224a'); g.addColorStop(0.5, '#0a1230'); g.addColorStop(1, '#101c40');
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'blur(12px)';
    const s = ctx.createLinearGradient(NW * 0.1, NH * 0.9, NW * 0.9, NH * 0.1);
    s.addColorStop(0.3, 'rgba(120,200,255,0)'); s.addColorStop(0.5, 'rgba(190,240,255,0.95)'); s.addColorStop(0.7, 'rgba(120,200,255,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'none';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 500; i++) { ctx.fillStyle = r() > 0.6 ? '#bfe8ff' : '#7fa0d8'; ctx.fillRect(r() * NW, r() * NH, 1.2, 1.2); }
    ctx.globalAlpha = 1;
  },
  marble(ctx, r) {
    ctx.fillStyle = '#f7e8e6'; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'blur(9px)';
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = `rgba(${200 + r() * 20},${140 + r() * 30},${150 + r() * 30},${0.2 + r() * 0.25})`;
      ctx.lineWidth = 8 + r() * 26; ctx.beginPath(); let x = r() * NW, y = 0; ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 140; y += NH / 6; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.filter = 'blur(1.2px)';
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = i % 2 ? 'rgba(212,169,90,0.9)' : 'rgba(150,100,110,0.5)';
      ctx.lineWidth = i % 2 ? 1.4 : 2.4; ctx.beginPath(); let x = r() * NW, y = r() * 80; ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 90; y += 62 + r() * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.filter = 'none';
  },
  matcha(ctx, r) {
    const g = ctx.createLinearGradient(0, NH, 0, 0);
    g.addColorStop(0, '#93aa88'); g.addColorStop(1, '#a6bb9a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    for (let i = 0; i < 220; i++) { ctx.fillStyle = r() > 0.3 ? 'rgba(250,244,226,0.9)' : 'rgba(60,85,55,0.55)'; ctx.beginPath(); ctx.arc(r() * NW, r() * NH, 0.8 + r() * 2.1, 0, 7); ctx.fill(); }
  },
  golden(ctx, r) {
    const g = ctx.createLinearGradient(0, NH, 0, 0);
    g.addColorStop(0, '#f7d3b8'); g.addColorStop(0.45, '#f1b98a'); g.addColorStop(0.75, '#e6a94a'); g.addColorStop(1, '#d99a26');
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    for (let i = 0; i < 1900; i++) {
      const y = r() * NH; const p = Math.pow(1 - y / NH, 1.5);
      if (r() > 0.15 + p * 0.85) continue;
      ctx.fillStyle = ['#fff2b8', '#ffd86b', '#f4b83a', '#ffffff'][(r() * 4) | 0];
      ctx.fillRect(r() * NW, y, 1.5 + r() * 2.6, 1.5 + r() * 2.6);
    }
  },
};

/** roughness (G) / metalness (B) texture for the sparkly finishes */
const ORM = {
  chrome(ctx) { ctx.fillStyle = 'rgb(0,18,255)'; ctx.fillRect(0, 0, NW, NH); },
  cateye(ctx, r) {
    ctx.fillStyle = 'rgb(0,40,120)'; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'blur(12px)';
    const s = ctx.createLinearGradient(NW * 0.1, NH * 0.9, NW * 0.9, NH * 0.1);
    s.addColorStop(0.3, 'rgba(0,10,255,0)'); s.addColorStop(0.5, 'rgba(0,10,255,1)'); s.addColorStop(0.7, 'rgba(0,10,255,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'none'; void r;
  },
  golden(ctx, r) {
    ctx.fillStyle = 'rgb(0,34,50)'; ctx.fillRect(0, 0, NW, NH);
    for (let i = 0; i < 1900; i++) {
      const y = r() * NH; const p = Math.pow(1 - y / NH, 1.5);
      if (r() > 0.15 + p * 0.85) continue;
      ctx.fillStyle = 'rgb(0,10,255)'; ctx.fillRect(r() * NW, y, 1.5 + r() * 2.6, 1.5 + r() * 2.6);
    }
  },
};

export function makeNailMaterial(product, maxAniso = 8, envIntensity = 1) {
  const c = canvas(NW, NH);
  PAINT[product.paint](c.getContext('2d'), rng(parseInt(product.id, 10) * 131), product);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = maxAniso;
  const params = { map, side: THREE.DoubleSide, specularIntensity: 1, ...product.mat, clearcoatRoughness: 0.02, envMapIntensity: envIntensity * 1.35 };
  if (ORM[product.paint]) {
    const o = canvas(NW, NH);
    ORM[product.paint](o.getContext('2d'), rng(parseInt(product.id, 10) * 17));
    const orm = new THREE.CanvasTexture(o);
    orm.anisotropy = maxAniso;
    params.roughnessMap = orm; params.metalnessMap = orm;
    params.roughness = 1; params.metalness = 1;
  }
  return new THREE.MeshPhysicalMaterial(params);
}

/** a sheer, natural nail for the cursor's finger */
export function makeBareNailMaterial() {
  const c = canvas(64, 128); const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, '#f1b9ae'); g.addColorStop(0.7, '#f4cabf'); g.addColorStop(1, '#f8ddd4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.1, side: THREE.DoubleSide, transparent: false });
}

/* ------------------------------------------------------------------ */
/*  packaging art                                                      */
/* ------------------------------------------------------------------ */

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function ls(ctx, v) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${v}px`; }

/** front of the box: 560 x 1040 px for 70 x 130 mm */
export function makeBoxFront(p) {
  const w = 560, h = 1040;
  const c = canvas(w, h); const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, p.tone); g.addColorStop(1, shade(p.tone, -0.05));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 34px ${FONT}`; ls(ctx, 14); ctx.fillText('LACQUER', w / 2 + 7, 84);
  ctx.fillStyle = p.accent; ctx.fillRect(w / 2 - 22, 108, 44, 3);
  // window frame (the real window is a hole in the card)
  ctx.strokeStyle = p.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 3;
  roundRect(ctx, 60, 140, w - 120, 600, 28); ctx.stroke(); ctx.globalAlpha = 1;
  // name
  ctx.fillStyle = p.ink; ls(ctx, 0);
  ctx.font = `italic 400 58px ${SERIF}`; ctx.fillText(p.name, w / 2, 836);
  ctx.font = `500 21px ${FONT}`; ls(ctx, 6); ctx.fillText(p.finish.toUpperCase(), w / 2 + 3, 884);
  ctx.globalAlpha = 0.7; ctx.font = `500 17px ${FONT}`; ls(ctx, 4);
  ctx.fillText('24 PRESS-ON NAILS · 12 SIZES', w / 2 + 2, 948);
  ctx.fillText('GLUE-FREE ADHESIVE INCLUDED', w / 2 + 2, 978);
  ctx.globalAlpha = 1;
  // swatch dot
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(w / 2, 1016, 6, 0, 7); ctx.fill();
  return tex(c);
}

/** the inside of the lid and the back of the box */
export function makeBoxBack(p) {
  const w = 560, h = 1040;
  const c = canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = shade(p.tone, 0.04); ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.ink; ctx.textAlign = 'left'; ls(ctx, 0);
  ctx.font = `italic 400 40px ${SERIF}`; ctx.fillText(p.name, 56, 110);
  ctx.font = `500 20px ${FONT}`; ls(ctx, 3); ctx.globalAlpha = 0.75;
  ['1  Prep — push back cuticles, buff, wipe.', '2  Size — pick the best fit for each nail.', '3  Press — hold firmly for 30 seconds.', '4  Wear — lasts up to 2 weeks.'].forEach((t, i) => ctx.fillText(t, 56, 200 + i * 50));
  ctx.globalAlpha = 1;
  for (let i = 0; i < 46; i++) { ctx.fillStyle = p.ink; ctx.fillRect(56 + i * 8, 900, (i * 7) % 3 + 2, 90); }
  return tex(c);
}

function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

/** the small paper sticker on the clear case: 512 x 160 px for 34 x 10.6 mm */
export function makeBoxLabel(p) {
  const w = 512, h = 160;
  const c = canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = shade(p.tone, 0.07); ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = p.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 3; ctx.strokeRect(8, 8, w - 16, h - 16); ctx.globalAlpha = 1;
  ctx.fillStyle = p.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 22px ${FONT}`; ls(ctx, 7); ctx.fillText('LACQUER', 30, 50);
  ctx.font = `italic 400 50px ${SERIF}`; ls(ctx, 0); ctx.fillText(p.name, 30, 108);
  ctx.font = `500 17px ${FONT}`; ls(ctx, 4); ctx.globalAlpha = 0.7; ctx.fillText(p.finish.toUpperCase(), 30, 140); ctx.globalAlpha = 1;
  ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(w - 44, h / 2, 16, 0, 7); ctx.fill();
  return tex(c);
}
