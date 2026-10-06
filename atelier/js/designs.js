import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Product catalogue                                                  */
/* ------------------------------------------------------------------ */

export const PRODUCTS = [
  {
    id: '01', name: 'Everyday Tee', price: 48, color: '#e9e3d6', ink: '#1c1c1a',
    colorName: 'Ivory', front: 'wordmark', back: 'caption',
    desc: 'Our quiet staple. Heavyweight organic cotton jersey, cut with a relaxed shoulder and a ribbed collar that keeps its shape.',
  },
  {
    id: '02', name: 'Soleil Tee', price: 56, color: '#1d1e20', ink: '#efe8da',
    colorName: 'Noir', front: 'ring', back: 'sun',
    desc: 'A slatted setting sun across the shoulder blades. Garment dyed for a soft, lived-in black that fades gracefully.',
  },
  {
    id: '03', name: 'Field Tee', price: 52, color: '#9aa88b', ink: '#f1eee4',
    colorName: 'Sage', front: 'leaf', back: 'mountains',
    desc: 'Line-drawn ridges and a single leaf. Mid-weight cotton with a washed hand-feel in a muted sage.',
  },
  {
    id: '04', name: 'Dune Tee', price: 52, color: '#b9654a', ink: '#f2e6d3',
    colorName: 'Terracotta', front: 'halfSun', back: 'waves',
    desc: 'Rolling lines inspired by wind on sand. Slightly boxy fit in a warm, earthen terracotta.',
  },
  {
    id: '05', name: 'Nord Tee', price: 54, color: '#26344f', ink: '#e8e4d9',
    colorName: 'Navy', front: 'nord', back: 'orbit',
    desc: 'Concentric rings and coordinates on deep navy. A graphic tee with the restraint of a uniform.',
  },
  {
    id: '06', name: 'Grid Tee', price: 50, color: '#d3c3a3', ink: '#2b2a27',
    colorName: 'Sand', front: 'grid3', back: 'grid',
    desc: 'Drafted on a grid. A modular back print in soft sand, made to sit square on the body.',
  },
  {
    id: '07', name: 'Studio Tee', price: 58, color: '#b4b5b5', ink: '#20211f', heather: true,
    colorName: 'Heather Grey', front: 'studio', back: 'numeral',
    desc: 'Our heathered, brushed jersey with an oversized numeral. Dense, soft and a little bit loud.',
  },
  {
    id: '08', name: 'Tide Tee', price: 52, color: '#8aa0b4', ink: '#f2efe6',
    colorName: 'Dusty Blue', front: 'arcs', back: 'tide',
    desc: 'Stacked lettering that reads like a tide chart. Soft dusty blue, finished with a tonal neck tape.',
  },
];

/* ------------------------------------------------------------------ */
/*  Canvas helpers                                                     */
/* ------------------------------------------------------------------ */

const CW = 2048;
const CH = 1230;
const FRONT_CX = 1536; // front panel is the right half of the texture
const BACK_CX = 512; // back panel is the left half

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function txt(ctx, s, x, y, size, weight = 600, spacing = 0, align = 'center') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x + (align === 'center' ? spacing / 2 : 0), y);
}

const FRONT = {
  wordmark(ctx, cx) { txt(ctx, 'atelier', cx + 170, 340, 46, 600, 5); },
  ring(ctx, cx) { ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx + 170, 330, 30, 0, Math.PI * 2); ctx.stroke(); },
  leaf(ctx, cx) {
    const x = cx + 170, y = 330;
    ctx.beginPath();
    ctx.moveTo(x - 34, y + 34);
    ctx.quadraticCurveTo(x - 40, y - 34, x + 34, y - 34);
    ctx.quadraticCurveTo(x + 40, y + 34, x - 34, y + 34);
    ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 34, y + 34); ctx.lineTo(x + 8, y - 8); ctx.stroke(); ctx.restore();
  },
  halfSun(ctx, cx) {
    const x = cx + 170, y = 345;
    ctx.beginPath(); ctx.arc(x, y, 30, Math.PI, 0); ctx.fill();
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const a = Math.PI + (k + 0.5) * (Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 42, y + Math.sin(a) * 42);
      ctx.lineTo(x + Math.cos(a) * 58, y + Math.sin(a) * 58);
      ctx.stroke();
    }
    ctx.fillRect(x - 58, y + 12, 116, 5);
  },
  nord(ctx, cx) { txt(ctx, 'NORD', cx + 170, 332, 38, 700, 7); txt(ctx, '59°N 10°E', cx + 170, 366, 20, 500, 4); },
  grid3(ctx, cx) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      if ((r + c) % 2 === 0) ctx.fillRect(cx + 140 + c * 30, 300 + r * 30, 22, 22);
      else { ctx.lineWidth = 3; ctx.strokeRect(cx + 141.5 + c * 30, 301.5 + r * 30, 19, 19); }
    }
  },
  studio(ctx, cx) { txt(ctx, 'STUDIO', cx + 170, 340, 44, 700, 9); },
  arcs(ctx, cx) {
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx + 170, 350, 18 + k * 17, Math.PI, 0); ctx.stroke(); }
  },
};

const BACK = {
  caption(ctx, cx) {
    txt(ctx, 'No. 01', cx, 270, 30, 600, 8);
    ctx.fillRect(cx - 28, 292, 56, 3);
  },
  sun(ctx, cx) {
    const y = 560, r = 230;
    ctx.beginPath(); ctx.arc(cx, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 7; k++) {
      const h = 7 + k * 6, yy = y + 20 + k * 30;
      ctx.fillRect(cx - r - 4, yy, r * 2 + 8, h);
    }
    ctx.restore();
  },
  mountains(ctx, cx) {
    ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const base = 700;
    ctx.beginPath();
    ctx.moveTo(cx - 280, base); ctx.lineTo(cx - 130, base - 230); ctx.lineTo(cx - 40, base - 110);
    ctx.lineTo(cx + 70, base - 330); ctx.lineTo(cx + 280, base); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 300, base + 40); ctx.lineTo(cx + 300, base + 40); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 150, base - 380, 34, 0, Math.PI * 2); ctx.stroke();
  },
  waves(ctx, cx) {
    ctx.lineWidth = 11; ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      for (let x = -270; x <= 270; x += 6) {
        const y = 480 + k * 64 + Math.sin(x / 55 + k * 0.7) * 26;
        if (x === -270) ctx.moveTo(cx + x, y); else ctx.lineTo(cx + x, y);
      }
      ctx.stroke();
    }
  },
  orbit(ctx, cx) {
    ctx.lineWidth = 8;
    for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, 580, k * 62, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - 290, 580); ctx.lineTo(cx + 290, 580); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 186 * Math.cos(-0.6), 580 + 186 * Math.sin(-0.6), 18, 0, Math.PI * 2); ctx.fill();
    txt(ctx, '59.9139° N  10.7522° E', cx, 930, 24, 500, 6);
  },
  grid(ctx, cx) {
    const x0 = cx - 240, y0 = 380, cw = 80, ch = 80, cols = 6, rows = 7;
    ctx.lineWidth = 4;
    for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(x0 + c * cw, y0); ctx.lineTo(x0 + c * cw, y0 + rows * ch); ctx.stroke(); }
    for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(x0, y0 + r * ch); ctx.lineTo(x0 + cols * cw, y0 + r * ch); ctx.stroke(); }
    ctx.fillRect(x0 + 2 * cw, y0 + 3 * ch, cw, ch);
    ctx.fillRect(x0 + 4 * cw, y0 + 1 * ch, cw, ch);
  },
  numeral(ctx, cx) {
    ctx.globalAlpha = 0.9;
    txt(ctx, '07', cx, 860, 540, 800, -20);
    ctx.globalAlpha = 1;
  },
  tide(ctx, cx) {
    ['T', 'I', 'D', 'E'].forEach((ch, k) => txt(ctx, ch, cx, 380 + k * 190, 176, 800, 0));
    txt(ctx, 'HIGH 04:12 · LOW 10:31', cx, 1000, 22, 500, 5);
  },
};

/* ------------------------------------------------------------------ */
/*  Textures                                                           */
/* ------------------------------------------------------------------ */

export function makePrintTexture(product, maxAnisotropy = 8) {
  const base = document.createElement('canvas');
  base.width = CW; base.height = CH;
  const ctx = base.getContext('2d');
  const rand = mulberry32(parseInt(product.id, 10) * 977);

  ctx.fillStyle = product.color;
  ctx.fillRect(0, 0, CW, CH);

  // subtle mottling / heather
  const speckle = product.heather ? 26000 : 5000;
  for (let i = 0; i < speckle; i++) {
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
    if (product.heather) ctx.fillStyle = light ? 'rgba(255,255,255,0.28)' : 'rgba(40,40,40,0.20)';
    const s = 1 + rand() * 2.2;
    ctx.fillRect(rand() * CW, rand() * CH, s, s * (1 + rand() * 2));
  }

  // print layer (separate so we can knock out + wear it)
  const layer = document.createElement('canvas');
  layer.width = CW; layer.height = CH;
  const lc = layer.getContext('2d');
  lc.fillStyle = product.ink; lc.strokeStyle = product.ink;
  FRONT[product.front](lc, FRONT_CX);
  lc.fillStyle = product.ink; lc.strokeStyle = product.ink;
  lc.globalAlpha = 1;
  BACK[product.back](lc, BACK_CX);
  // worn-print speckle
  lc.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7000; i++) {
    lc.fillStyle = `rgba(0,0,0,${0.25 + rand() * 0.4})`;
    const s = 1 + rand() * 2.5;
    lc.fillRect(rand() * CW, 200 + rand() * 900, s, s);
  }
  ctx.globalAlpha = 0.94;
  ctx.drawImage(layer, 0, 0);
  ctx.globalAlpha = 1;

  // hem stitching on both panels
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 2.2; ctx.setLineDash([11, 7]);
  const hemY = CH * (1 - 0.034);
  ctx.beginPath(); ctx.moveTo(0, hemY); ctx.lineTo(CW, hemY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, hemY + 11); ctx.lineTo(CW, hemY + 11); ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(base);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/** Tiny jersey-knit bump texture, tiled over the garment. */
export function makeFabricBump(maxAnisotropy = 8) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const rand = mulberry32(1234);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // staggered "v" knit columns
      const col = (x % 8) / 8;
      const stagger = Math.floor(x / 8) % 2 ? 4 : 0;
      const row = ((y + stagger) % 8) / 8;
      const v = Math.abs(col - 0.5) * 2; // 0..1
      const loop = Math.sin(row * Math.PI) * (1 - v * 0.6);
      const g = 120 + loop * 80 + (rand() - 0.5) * 26;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, g));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
