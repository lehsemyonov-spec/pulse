/**
 * Формы облака: каждая — Float32Array из count × xyz в «единицах формы».
 * Масштаб облака подобран так, что сердце высотой 2 занимает config.heart.fill экрана.
 * Формы, которые должны заполнять экран (хаос, город, руки, созвездия), получают
 * размеры видимой области в тех же единицах (View) и пересчитываются при resize.
 */
import { config } from '../config';

export type ShapePoints = Float32Array;
export type ShapeName = 'heart' | 'chaos' | 'city' | 'hands' | 'constellations' | 'ring';
/** Половина видимой ширины и высоты на плоскости z = 0, в единицах формы */
export type View = { halfW: number; halfH: number };

/** Порядок экранов 1–6 (BRIEF → «Структура и сценарий сайта») */
export const SHAPE_ORDER: ShapeName[] = ['heart', 'chaos', 'city', 'hands', 'constellations', 'ring'];

/** Детерминированный ГПСЧ — формы одинаковы при каждой загрузке. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Центрирует и приводит к высоте 2. */
function normalize(p: Float32Array): Float32Array {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
    minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]);
    minZ = Math.min(minZ, p[i + 2]); maxZ = Math.max(maxZ, p[i + 2]);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const s = 2 / (maxY - minY || 1);
  for (let i = 0; i < p.length; i += 3) {
    p[i] = (p[i] - cx) * s;
    p[i + 1] = (p[i + 1] - cy) * s;
    p[i + 2] = (p[i + 2] - cz) * s;
  }
  return p;
}

/* ------------------------------------------------------------------ */
/* Маски: светлые пиксели → точки, яркость → вес и глубина               */
/* ------------------------------------------------------------------ */

type MaskSource = HTMLImageElement | HTMLCanvasElement;
/** u, v в [-1, 1] (v вверх), l — яркость 0–1 */
type MaskSample = { u: Float32Array; v: Float32Array; l: Float32Array; aspect: number };

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

function sampleMask(src: MaskSource, count: number, seed: number, threshold = 0.08): MaskSample {
  const rand = mulberry32(seed);
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  // ~512 px по длинной стороне хватает: точек всё равно меньше, чем пикселей
  const k = Math.min(1, 512 / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const lum = new Float32Array(w * h);
  const idx: number[] = [];
  for (let p = 0; p < w * h; p++) {
    const l = ((0.2126 * data[p * 4] + 0.7152 * data[p * 4 + 1] + 0.0722 * data[p * 4 + 2]) / 255) * (data[p * 4 + 3] / 255);
    lum[p] = l;
    if (l > threshold) idx.push(p);
  }
  if (idx.length === 0) throw new Error('Маска пустая: нет светлых пикселей');

  const out: MaskSample = { u: new Float32Array(count), v: new Float32Array(count), l: new Float32Array(count), aspect: w / h };
  let i = 0;
  let guard = 0;
  while (i < count && guard++ < count * 200) {
    const p = idx[(rand() * idx.length) | 0];
    if (rand() > lum[p]) continue; // яркие места плотнее
    out.u[i] = (((p % w) + rand()) / w) * 2 - 1;
    out.v[i] = -((((p / w) | 0) + rand()) / h) * 2 + 1;
    out.l[i] = lum[p];
    i++;
  }
  return out;
}

/** Форма из маски по правилу ТЗ: яркость = глубина. Нормализована к высоте 2. */
export function shapeFromMask(src: MaskSource, count: number, opts: { depth?: number; seed?: number } = {}): ShapePoints {
  const { depth = 0.5, seed = 7 } = opts;
  const rand = mulberry32(seed + 1);
  const s = sampleMask(src, count, seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = s.u[i] * s.aspect;
    out[i * 3 + 1] = s.v[i];
    out[i * 3 + 2] = (rand() * 2 - 1) * s.l[i] * depth; // симметричный объём вокруг плоскости
  }
  return normalize(out);
}

async function tryMask(name: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(`${import.meta.env.BASE_URL}shapes/${name}.png`);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 1. Сердце — объёмная поверхность Таубина                              */
/* (x² + 9/4·y² + z² − 1)³ − x²·z³ − 9/80·y²·z³ = 0, z — вверх          */
/* ------------------------------------------------------------------ */

function heartF(x: number, y: number, z: number): number {
  const a = x * x + 2.25 * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
}

function heartRadius(dx: number, dy: number, dz: number): number {
  let lo = 0, hi = 1.8;
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (heartF(dx * m, dy * m, dz * m) < 0) lo = m; else hi = m;
  }
  return lo;
}

export function proceduralHeart(count: number, seed = 72): ShapePoints {
  const rand = mulberry32(seed);
  const out = new Float32Array(count * 3);
  const shell = config.heart.shell;
  const R_MAX = 1.45;
  let i = 0;
  while (i < count) {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dx = s * Math.cos(phi), dy = s * Math.sin(phi), dz = u;
    const r = heartRadius(dx, dy, dz);
    if (r <= 0) continue;
    if (rand() > (r * r) / (R_MAX * R_MAX)) continue; // равномерно по площади
    const k = rand() < shell ? r * (1 - Math.abs(gauss(rand)) * 0.035) : r * Math.cbrt(rand()) * 0.96;
    out[i * 3] = dx * k;
    out[i * 3 + 1] = dz * k;
    out[i * 3 + 2] = dy * k;
    i++;
  }
  return normalize(out);
}

/* ------------------------------------------------------------------ */
/* 2. Хаос — разрозненные точки по всему экрану                          */
/* ------------------------------------------------------------------ */

export function chaos(count: number, view: View, seed = 2): ShapePoints {
  const rand = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = (rand() * 2 - 1) * view.halfW * 1.15;
    out[i * 3 + 1] = (rand() * 2 - 1) * view.halfH * 1.15;
    out[i * 3 + 2] = (rand() * 2 - 1) * 1.6;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Карта города — улицы на наклонной плоскости                        */
/* ------------------------------------------------------------------ */

function drawCity(w: number, h: number, seed: number): HTMLCanvasElement {
  const rand = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  const line = (x1: number, y1: number, x2: number, y2: number, width: number, gray: number) => {
    ctx.strokeStyle = `rgb(${gray},${gray},${gray})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  // Сетка кварталов, слегка повёрнутая — как в старом центре
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.16);
  const span = Math.max(w, h) * 0.85;
  const step = w / 26;
  for (let x = -span; x <= span; x += step * (0.7 + rand() * 0.6)) {
    // переулки с разрывами — получаются кварталы разного размера
    let y = -span;
    while (y < span) {
      const len = step * (2 + rand() * 6);
      if (rand() > 0.22) line(x, y, x + (rand() - 0.5) * 6, y + len, 2.2, 165);
      y += len + step * (rand() < 0.3 ? 1 : 0);
    }
  }
  for (let y = -span; y <= span; y += step * (0.7 + rand() * 0.6)) {
    let x = -span;
    while (x < span) {
      const len = step * (2 + rand() * 6);
      if (rand() > 0.22) line(x, y, x + len, y + (rand() - 0.5) * 6, 2.2, 165);
      x += len + step * (rand() < 0.3 ? 1 : 0);
    }
  }
  // Проспекты
  for (let k = -3; k <= 3; k++) line(k * step * 5.2, -span, k * step * 5.2 + step, span, 3.5, 215);
  for (let k = -3; k <= 3; k++) line(-span, k * step * 4.6, span, k * step * 4.6 - step * 0.6, 3.5, 215);
  ctx.restore();

  // Диагональный проспект
  line(-w * 0.1, h * 1.05, w * 1.1, -h * 0.05, 4.5, 235);

  // Река — пустая полоса с набережными
  const river = new Path2D();
  river.moveTo(-20, h * 0.78);
  river.bezierCurveTo(w * 0.3, h * 0.55, w * 0.55, h * 0.95, w + 20, h * 0.62);
  ctx.strokeStyle = 'rgb(200,200,200)';
  ctx.lineWidth = w * 0.05 + 6;
  ctx.stroke(river);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = w * 0.05;
  ctx.stroke(river);
  return c;
}

export async function city(count: number, view: View, seed = 3): Promise<ShapePoints> {
  // на вертикальном экране карта наклонена меньше, иначе верх экрана пустой
  const portrait = view.halfW < view.halfH;
  const tilt = config.city.tilt * (portrait ? 0.62 : 1);
  // и короче в глубину: точек на телефоне меньше, на огромной плоскости улицы не читаются
  const pz = view.halfH * config.city.depth * (portrait ? 0.55 : 1);
  // Плоскость больше экрана: после наклона она должна закрыть его целиком
  const px = view.halfW * config.city.width;
  const img = await tryMask('city');
  const src = img ?? drawCity(1024, Math.round((1024 * pz) / px), seed);
  const s = sampleMask(src, count, seed);
  const rand = mulberry32(seed + 9);
  const out = new Float32Array(count * 3);
  const sin = Math.sin(tilt), cos = Math.cos(tilt);
  for (let i = 0; i < count; i++) {
    const x = s.u[i] * px;
    const z = -s.v[i] * pz; // верх маски — даль
    const y = (rand() - 0.5) * 0.02; // почти плоско
    out[i * 3] = x;
    out[i * 3 + 1] = y * cos - z * sin + config.city.offsetY * view.halfH;
    out[i * 3 + 2] = y * sin + z * cos;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 4. Две руки, тянущиеся друг к другу                                   */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

function drawHands(): HTMLCanvasElement {
  const W = 1600, H = 800;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Объём «по слоям»: широкий тёмный контур → узкая яркая сердцевина (яркость = глубина)
  // max — яркость сердцевины: она же вес выборки, поэтому кисти ярче предплечий
  const limb = (pts: Pt[], width: number, max = 255) => {
    for (let k = 0; k < 5; k++) {
      const g = Math.round((95 + k * 40) * (max / 255));
      ctx.strokeStyle = `rgb(${g},${g},${g})`;
      ctx.lineWidth = width * (1 - k * 0.18);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
  };
  const palm = (x: number, y: number, rx: number, ry: number, rot: number) => {
    for (let k = 0; k < 5; k++) {
      const g = Math.round((95 + k * 40) * 0.9);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * (1 - k * 0.16), ry * (1 - k * 0.16), rot, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Левая рука: расслабленная, указательный палец чуть провисает
  const left = () => {
    limb([[-80, 610], [200, 530], [450, 455]], 92, 120);
    palm(528, 430, 98, 66, -0.18);
    limb([[500, 392], [556, 352], [618, 346]], 34); // большой
    limb([[592, 404], [672, 390], [752, 408]], 33); // указательный
    limb([[598, 434], [660, 446], [674, 482]], 32); // средний
    limb([[584, 460], [634, 474], [644, 506]], 30); // безымянный
    limb([[562, 482], [600, 498], [606, 522]], 26); // мизинец
  };
  // Правая рука: тянется, указательный прямой
  const right = () => {
    limb([[W + 80, 250], [1400, 300], [1150, 372]], 90, 120);
    palm(1072, 386, 96, 62, 0.12);
    limb([[1100, 352], [1050, 318], [994, 318]], 33); // большой
    limb([[1012, 372], [930, 372], [850, 378]], 32); // указательный
    limb([[1008, 402], [948, 414], [938, 446]], 31); // средний
    limb([[1018, 428], [968, 440], [962, 468]], 29); // безымянный
    limb([[1034, 450], [998, 464], [994, 486]], 25); // мизинец
  };
  left();
  right();
  return c;
}

export async function hands(count: number, view: View, seed = 4): Promise<ShapePoints> {
  const img = await tryMask('hands');
  const p = shapeFromMask(img ?? drawHands(), count, { depth: 0.35, seed });
  // Вписываем по ширине: руки тянутся почти от края до края.
  // На вертикальном экране предплечья уходят за края, чтобы кисти остались крупными.
  let maxX = 0;
  for (let i = 0; i < p.length; i += 3) maxX = Math.max(maxX, Math.abs(p[i]));
  const portrait = view.halfW < view.halfH;
  const s = Math.min(1.1, (view.halfW * (portrait ? 1.75 : 0.98)) / maxX);
  for (let i = 0; i < p.length; i++) p[i] *= s;
  return p;
}

/* ------------------------------------------------------------------ */
/* 5. Созвездия — N светящихся групп (подсветка по слайдеру — этап 6)    */
/* ------------------------------------------------------------------ */

export function constellations(count: number, view: View, seed = 5): ShapePoints {
  const rand = mulberry32(seed);
  const groups = config.constellations.groups;
  const centers: [number, number, number, number][] = [];
  // центры: случайно, но не ближе minDist друг к другу
  const minDist = Math.min(view.halfW, view.halfH) * 0.28;
  let guard = 0;
  while (centers.length < groups && guard++ < 5000) {
    const x = (rand() * 2 - 1) * view.halfW * 0.86;
    const y = (rand() * 2 - 1) * view.halfH * 0.78;
    if (centers.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < minDist)) continue;
    centers.push([x, y, (rand() * 2 - 1) * 0.6, 0.06 + rand() * 0.1]);
  }
  const out = new Float32Array(count * 3);
  const dust = Math.floor(count * 0.12); // фон: редкая пыль
  for (let i = 0; i < count; i++) {
    if (i < dust) {
      out[i * 3] = (rand() * 2 - 1) * view.halfW * 1.1;
      out[i * 3 + 1] = (rand() * 2 - 1) * view.halfH * 1.1;
      out[i * 3 + 2] = (rand() * 2 - 1) * 1.2;
      continue;
    }
    const [cx, cy, cz, r] = centers[i % centers.length];
    out[i * 3] = cx + gauss(rand) * r;
    out[i * 3 + 1] = cy + gauss(rand) * r;
    out[i * 3 + 2] = cz + gauss(rand) * r;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 6. Кольцо вокруг кнопки CTA                                           */
/* ------------------------------------------------------------------ */

export function ring(count: number, seed = 6): ShapePoints {
  const rand = mulberry32(seed);
  const out = new Float32Array(count * 3);
  const R = config.ring.radius;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    // плотная полоса + мягкий ореол наружу
    const halo = rand() < 0.18;
    const r = R + (halo ? Math.abs(gauss(rand)) * 0.22 : gauss(rand) * 0.035);
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = Math.sin(a) * r;
    out[i * 3 + 2] = gauss(rand) * (halo ? 0.12 : 0.05);
  }
  return out;
}

/* ------------------------------------------------------------------ */

export async function heartShape(count: number): Promise<{ points: ShapePoints; source: 'mask' | 'procedural' }> {
  const mode = config.heart.source;
  if (mode !== 'procedural') {
    const img = await tryMask('heart');
    if (img) return { points: shapeFromMask(img, count, { depth: config.heart.maskDepth }), source: 'mask' };
    if (mode === 'mask') console.warn('[pulse] heart.png не загрузилась, беру процедурное сердце');
  }
  return { points: proceduralHeart(count), source: 'procedural' };
}

/** Формы, зависящие от размеров экрана — пересчитываются при resize. */
export const RESPONSIVE: ShapeName[] = ['heart', 'chaos', 'city', 'hands', 'constellations', 'ring'];

async function rawShape(name: ShapeName, count: number, view: View): Promise<ShapePoints> {
  switch (name) {
    case 'heart': return (await heartShape(count)).points;
    case 'chaos': return chaos(count, view);
    case 'city': return city(count, view);
    case 'hands': return hands(count, view);
    case 'constellations': return constellations(count, view);
    case 'ring': return ring(count);
  }
}

/** Центр «сцены» экрана в вёрстке, в долях половины экрана (x вправо, y вверх). */
export type Anchor = { x: number; y: number; /** высота сцены в долях экрана */ h: number };

/**
 * Форма + её место на экране: центр сцены из вёрстки (.screen__stage) + тонкая поправка config.layout.
 * Так сердце встаёт между заголовком и кнопками, а кольцо — точно вокруг кнопки CTA.
 */
export async function buildShape(name: ShapeName, count: number, view: View, anchor: Anchor = { x: 0, y: 0, h: 1 }): Promise<ShapePoints> {
  const p = await rawShape(name, count, view);
  const l = config.layout[name];
  const portrait = view.halfW < view.halfH;
  const dx = ((portrait ? l.mx : l.x) + anchor.x) * view.halfW;
  const dy = ((portrait ? l.my : l.y) + anchor.y) * view.halfH;
  if (dx || dy) {
    for (let i = 0; i < p.length; i += 3) {
      p[i] += dx;
      p[i + 1] += dy;
    }
  }
  return p;
}
