import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Catalogue                                                          */
/* ------------------------------------------------------------------ */

/*
 * Each product can optionally use real photos (paths are relative to index.html):
 *   photo:     a photo of the whole set. It is shown inside the clear case on the wall instead of the generated nails.
 *   nailImage: a photo of ONE nail, shot top-down with the cuticle at the bottom. It is wrapped onto the 3D nails in the try-on.
 * Leave them out and the shop draws the set itself. See images/README.md.
 */
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
  { id: '09', name: 'Pink Pearl', price: 24, tone: '#f3d6e2', ink: '#5a2c42', accent: '#f4b6d0', shape: 'almond', length: 1, finish: 'Glazed · Chrome', paint: 'chrome', pc: ['#f1e0e6', '#f7c9dc', '#fde9f1', '#e9d2e6', '#faf0f5'], mat: { roughness: 0.1, metalness: 1, clearcoat: 0.6 }, desc: 'The glazed-donut finish: a milky pearl chrome with a soft pink flush.' },
  { id: '10', name: 'Burgundy Velvet', price: 22, tone: '#d9a8b4', ink: '#3a0c1a', accent: '#8a1f3c', shape: 'almond', length: 1, finish: 'Magnetic · Wine', paint: 'cateye', pc: ['#4a0c1e', '#1e050d', '#f08aa4'], mat: { roughness: 0.1, metalness: 0.55, clearcoat: 1 }, desc: 'Deep wine with a velvet magnetic shimmer that glows rose in the light.' },
  { id: '11', name: 'Tortoise Shell', price: 22, tone: '#e5c9a0', ink: '#3b2410', accent: '#b9772c', shape: 'coffin', length: 1, finish: 'Gloss · Amber', paint: 'tortoise', pc: ['#d99a3d', '#4a2a10'], mat: { roughness: 0.06, metalness: 0, clearcoat: 1 }, desc: 'Honey amber clouded with dark tortoiseshell, in a short coffin.' },
  { id: '12', name: 'Blueberry Aura', price: 22, tone: '#cfd0f2', ink: '#2c2a6a', accent: '#8f8aef', shape: 'oval', length: 1, finish: 'Airbrush · Periwinkle', paint: 'aura', pc: ['#ece9fc', '#8f8aef', '#c7b6f7'], mat: { roughness: 0.12, metalness: 0, clearcoat: 1 }, desc: 'A soft airbrushed glow, periwinkle fading to milk at the edges.' },
  { id: '13', name: 'Checkmate', price: 20, tone: '#d8d6d2', ink: '#101010', accent: '#222222', shape: 'square', length: 1, finish: 'Gloss · Mono', paint: 'checker', pc: ['#111111', '#f4f1ea'], mat: { roughness: 0.06, metalness: 0, clearcoat: 1 }, desc: 'A crisp black-and-white check on a short square nail.' },
  { id: '14', name: 'Night Sky', price: 22, tone: '#b9bfe0', ink: '#0e1636', accent: '#fff3b0', shape: 'almond', length: 2, finish: 'Gloss · Stars', paint: 'stars', pc: ['#0e1636', '#fff3b0'], mat: { roughness: 0.07, metalness: 0.1, clearcoat: 1 }, desc: 'Midnight blue scattered with tiny gold stars. Long, dreamy almonds.' },
  { id: '15', name: 'Leopard Latte', price: 20, tone: '#ead3b4', ink: '#3b2614', accent: '#b98a5c', shape: 'coffin', length: 1, finish: 'Gloss · Animal', paint: 'leopard', pc: ['#dbb88e', '#5a3a22'], mat: { roughness: 0.08, metalness: 0, clearcoat: 1 }, desc: 'Latte leopard spots with a glossy finish. Wild, but make it neutral.' },
  { id: '16', name: 'Soft Rainbow', price: 20, tone: '#f6e4ec', ink: '#5b3550', accent: '#9fd3c7', shape: 'almond', length: 1, finish: 'Gloss · Pastel', paint: 'rainbow', pc: ['#ffb3c1', '#ffd6a5', '#fdf1a6', '#b5ead7', '#b7c7ff'], mat: { roughness: 0.08, metalness: 0, clearcoat: 1 }, desc: 'Pastel stripes in five soft colours, one for every finger.' },
  { id: '17', name: 'Sunset Ombré', price: 24, tone: '#f6d3c0', ink: '#6a2a2a', accent: '#ff7f8f', shape: 'stiletto', length: 2, finish: 'Gloss · Ombré', paint: 'ombre', pc: ['#ffe0a8', '#ff9a7a', '#ff5f8b'], mat: { roughness: 0.07, metalness: 0, clearcoat: 1 }, desc: 'Golden peach melts into hot pink. A long stiletto for golden hour.' },
  { id: '18', name: 'Candy Glitter', price: 22, tone: '#f6cfe2', ink: '#6a1f4a', accent: '#ff6fae', shape: 'coffin', length: 1, finish: 'Glitter · Pink', paint: 'glitter', orm: 'glitter', pc: ['#ff9ec7', '#ff6fae', '#ffe6f2'], mat: { roughness: 0.1, metalness: 0.2, clearcoat: 1 }, desc: 'Bubblegum pink packed with fine glitter that catches every light.' },
  { id: '19', name: 'Ocean Wave', price: 20, tone: '#cfe0f0', ink: '#103a6a', accent: '#2f6fb8', shape: 'almond', length: 1, finish: 'Gloss · Blue', paint: 'wave', pc: ['#2f6fb8', '#eaf4ff'], mat: { roughness: 0.07, metalness: 0, clearcoat: 1 }, desc: 'Cobalt blue with white swells. Clean, graphic, a little bit surf.' },
  { id: '20', name: 'Polka Cream', price: 18, tone: '#f1e6d2', ink: '#5a1f30', accent: '#e0587a', shape: 'oval', length: 1, finish: 'Gloss · Dots', paint: 'dots', pc: ['#f7efe0', '#e0587a'], mat: { roughness: 0.08, metalness: 0, clearcoat: 1 }, desc: 'Cream base with raspberry polka dots. Playful and retro.' },
  { id: '21', name: 'Lilac Jelly', price: 18, tone: '#e3d6f5', ink: '#3f2a6e', accent: '#b49ae6', shape: 'almond', length: 1, finish: 'Jelly · Lilac', paint: 'solid', pc: ['#d8c6f6', '#b49ae6'], mat: { roughness: 0.04, metalness: 0, clearcoat: 1 }, desc: 'A juicy, see-through lilac jelly with a wet shine.' },
  { id: '22', name: 'Forest Matte', price: 18, tone: '#bfd0c4', ink: '#12281c', accent: '#2f4a3a', shape: 'square', length: 1, finish: 'Matte · Green', paint: 'solid', pc: ['#35553f', '#233a2c'], mat: { roughness: 0.62, metalness: 0, clearcoat: 0 }, desc: 'Deep forest green with a velvet matte finish. Understated, rich.' },
  { id: '23', name: 'Gingham Picnic', price: 20, tone: '#f4d3d6', ink: '#6a1f2e', accent: '#e2556f', shape: 'square', length: 1, finish: 'Gloss · Check', paint: 'gingham', pc: ['#e2556f'], mat: { roughness: 0.08, metalness: 0, clearcoat: 1 }, desc: 'Red gingham on white. Sunday-picnic sweet.' },
  { id: '24', name: 'Silver Lining', price: 26, tone: '#dcdfe6', ink: '#2a2f3c', accent: '#c9ccd3', shape: 'stiletto', length: 2, finish: 'Mirror · Silver', paint: 'chrome', pc: ['#f4f5f7', '#c9ccd3', '#ffffff', '#9ea3ad', '#eef0f4'], mat: { roughness: 0.06, metalness: 1, clearcoat: 0.5 }, desc: 'Pure liquid silver on a long, sharp stiletto.' },
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
  chrome(ctx, r, p) {
    const stops = (p && p.pc) || ['#e9eaf2', '#f6d4e6', '#cfe0ff', '#e7d6f6', '#f4f6fb'];
    const g = ctx.createLinearGradient(0, NH, NW, 0);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'blur(10px)';
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = ['rgba(255,170,215,0.35)', 'rgba(150,200,255,0.4)', 'rgba(255,255,255,0.5)'][i % 3];
      ctx.lineWidth = 18 + r() * 24; ctx.beginPath(); ctx.moveTo(-20, r() * NH); ctx.bezierCurveTo(80, r() * NH, 170, r() * NH, NW + 20, r() * NH); ctx.stroke();
    }
    ctx.filter = 'none';
  },
  cateye(ctx, r, p) {
    const pc = (p && p.pc) || ['#16224a', '#0a1230', '#bfe8ff'];
    const g = ctx.createLinearGradient(0, 0, NW, NH);
    g.addColorStop(0, pc[0]); g.addColorStop(0.5, pc[1]); g.addColorStop(1, pc[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'blur(12px)';
    const s = ctx.createLinearGradient(NW * 0.1, NH * 0.9, NW * 0.9, NH * 0.1);
    s.addColorStop(0.3, 'rgba(255,255,255,0)'); s.addColorStop(0.5, pc[2]); s.addColorStop(0.7, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'none';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 500; i++) { ctx.fillStyle = r() > 0.6 ? pc[2] : pc[0]; ctx.fillRect(r() * NW, r() * NH, 1.2, 1.2); }
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
  solid(ctx, r, p) {
    const g = ctx.createLinearGradient(0, NH, 0, 0);
    g.addColorStop(0, p.pc[0]); g.addColorStop(1, p.pc[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    const s = ctx.createLinearGradient(30, 0, 120, 0);
    s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.18)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.fillRect(30, 60, 90, 400); void r;
  },
  ombre(ctx, r, p) {
    const g = ctx.createLinearGradient(0, NH, 0, 0);
    g.addColorStop(0, p.pc[0]); g.addColorStop(0.55, p.pc[1]); g.addColorStop(1, p.pc[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH); void r;
  },
  aura(ctx, r, p) {
    ctx.fillStyle = p.pc[0]; ctx.fillRect(0, 0, NW, NH);
    const blob = (x, y, rad, c, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, c); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH); ctx.globalAlpha = 1; };
    blob(NW * 0.5, NH * 0.5, 230, p.pc[1], 0.95); blob(NW * 0.55, NH * 0.62, 150, p.pc[2], 0.7); blob(NW * 0.5, NH * 0.4, 90, p.pc[0], 0.6); void r;
  },
  checker(ctx, r, p) {
    const n = 4, w = NW / n;
    for (let y = 0; y * w < NH; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = (x + y) % 2 ? p.pc[0] : p.pc[1]; ctx.fillRect(x * w, NH - (y + 1) * w, w + 1, w + 1); } void r;
  },
  tortoise(ctx, r, p) {
    ctx.fillStyle = p.pc[0]; ctx.fillRect(0, 0, NW, NH);
    ctx.filter = 'blur(7px)';
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(${74 + r() * 30},${42 + r() * 20},16,${0.35 + r() * 0.5})`; ctx.beginPath(); ctx.ellipse(r() * NW, r() * NH, 14 + r() * 46, 10 + r() * 36, r() * 3, 0, 7); ctx.fill(); }
    ctx.filter = 'none';
  },
  stars(ctx, r, p) {
    const g = ctx.createLinearGradient(0, NH, 0, 0); g.addColorStop(0, p.pc[0]); g.addColorStop(1, '#1b2a66'); ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    for (let i = 0; i < 18; i++) {
      const x = r() * NW, y = r() * NH, R = 6 + r() * 16; ctx.fillStyle = p.pc[1]; ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, rr2 = k % 2 ? R * 0.28 : R; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 240; i++) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(r() * NW, r() * NH, 1.4, 1.4); }
  },
  leopard(ctx, r, p) {
    ctx.fillStyle = p.pc[0]; ctx.fillRect(0, 0, NW, NH);
    for (let i = 0; i < 40; i++) {
      const x = r() * NW, y = r() * NH, R = 10 + r() * 16; ctx.strokeStyle = p.pc[1]; ctx.lineWidth = 5 + r() * 4;
      ctx.beginPath(); ctx.arc(x, y, R, 0.4 + r(), 5.2 + r() * 0.8); ctx.stroke(); ctx.fillStyle = 'rgba(60,35,18,0.25)'; ctx.beginPath(); ctx.arc(x, y, R * 0.55, 0, 7); ctx.fill();
    }
  },
  rainbow(ctx, r, p) {
    const w = NW / p.pc.length; p.pc.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, 0, w + 1, NH); });
    ctx.filter = 'blur(4px)'; ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, NH * 0.5, NW, 40); ctx.filter = 'none'; void r;
  },
  glitter(ctx, r, p) {
    const g = ctx.createLinearGradient(0, NH, 0, 0); g.addColorStop(0, p.pc[0]); g.addColorStop(1, p.pc[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, NW, NH);
    for (let i = 0; i < 1900; i++) { ctx.fillStyle = r() > 0.5 ? p.pc[2] : '#ffffff'; ctx.fillRect(r() * NW, r() * NH, 1.5 + r() * 2.6, 1.5 + r() * 2.6); }
  },
  wave(ctx, r, p) {
    ctx.fillStyle = p.pc[0]; ctx.fillRect(0, 0, NW, NH);
    ctx.strokeStyle = p.pc[1]; ctx.lineWidth = 14; ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) { ctx.beginPath(); for (let x = -10; x <= NW + 10; x += 6) { const y = 40 + k * 56 + Math.sin(x / 34 + k * 0.8) * 16; x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); } void r;
  },
  dots(ctx, r, p) {
    ctx.fillStyle = p.pc[0]; ctx.fillRect(0, 0, NW, NH); ctx.fillStyle = p.pc[1];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 5; x++) { ctx.beginPath(); ctx.arc(24 + x * 52 + (y % 2) * 26, 30 + y * 58, 12, 0, 7); ctx.fill(); } void r;
  },
  gingham(ctx, r, p) {
    ctx.fillStyle = '#fbf6f2'; ctx.fillRect(0, 0, NW, NH);
    ctx.fillStyle = p.pc[0]; ctx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 64, 0, 32, NH);
    for (let j = 0; j < 14; j++) ctx.fillRect(0, j * 64, NW, 32);
    ctx.globalAlpha = 1; void r;
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
  glitter(ctx, r) { ORM.golden(ctx, r); },
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
  const ormKey = product.orm || product.paint;
  if (ORM[ormKey]) {
    const o = canvas(NW, NH);
    ORM[ormKey](o.getContext('2d'), rng(parseInt(product.id, 10) * 17));
    const orm = new THREE.CanvasTexture(o);
    orm.anisotropy = maxAniso;
    params.roughnessMap = orm; params.metalnessMap = orm;
    params.roughness = 1; params.metalness = 1;
  }
  const mat = new THREE.MeshPhysicalMaterial(params);
  // optional: a real photo of one nail (top-down, cuticle at the bottom) replaces the painted art
  if (product.nailImage) {
    loadImageTexture(product.nailImage, maxAniso).then((t) => { if (t) { mat.map = t; mat.needsUpdate = true; } });
  }
  return mat;
}

/** loads an image file as a colour texture; resolves to null (and logs once) if it can't be loaded */
export function loadImageTexture(url, maxAniso = 8) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; resolve(t); }, undefined, () => { console.warn(`Could not load image: ${url}`); resolve(null); });
  });
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
