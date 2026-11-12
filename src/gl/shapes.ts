/**
 * Формы облака: каждая — Float32Array из count × xyz.
 * Все формы нормализованы одинаково: центр в 0, высота 2 (y от −1 до 1),
 * поэтому масштаб под экран считается в одном месте (Particles.fit).
 */
import { config } from '../config';

export type ShapePoints = Float32Array;

/** Детерминированный ГПСЧ — форма одинакова при каждой загрузке. */
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
/* Процедурное объёмное сердце (поверхность Таубина)                    */
/* (x² + 9/4·y² + z² − 1)³ − x²·z³ − 9/80·y²·z³ = 0, z — вверх          */
/* ------------------------------------------------------------------ */

function heartF(x: number, y: number, z: number): number {
  const a = x * x + 2.25 * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
}

/** Расстояние от центра до поверхности вдоль направления (бисекция). */
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
    // случайное направление на сфере
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dx = s * Math.cos(phi), dy = s * Math.sin(phi), dz = u;
    const r = heartRadius(dx, dy, dz);
    if (r <= 0) continue;
    // выравниваем плотность по площади поверхности: принимаем с вероятностью ~ r²
    if (rand() > (r * r) / (R_MAX * R_MAX)) continue;

    let k: number;
    if (rand() < shell) {
      // поверхность с мягкой «дымкой» внутрь
      k = r * (1 - Math.abs(gauss(rand)) * 0.035);
    } else {
      // объём: равномерно внутри
      k = r * Math.cbrt(rand()) * 0.96;
    }
    // формула: z вверх, y — глубина → в three: y вверх, z к камере
    out[i * 3] = dx * k;
    out[i * 3 + 1] = dz * k;
    out[i * 3 + 2] = dy * k;
    i++;
  }
  return normalize(out);
}

/* ------------------------------------------------------------------ */
/* Форма из ч/б PNG-маски: светлые пиксели → точки, яркость → глубина    */
/* ------------------------------------------------------------------ */

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

export function shapeFromMask(
  img: HTMLImageElement,
  count: number,
  opts: { depth?: number; threshold?: number; seed?: number } = {},
): ShapePoints {
  const { depth = 0.5, threshold = 0.08, seed = 7 } = opts;
  const rand = mulberry32(seed);

  // Достаточно ~512 px по длинной стороне: точек всё равно меньше, чем пикселей.
  const max = 512;
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Кандидаты — пиксели светлее порога; яркость = вес выборки и глубина.
  const lum = new Float32Array(w * h);
  const idx: number[] = [];
  for (let p = 0; p < w * h; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2], a = data[p * 4 + 3];
    const l = ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * (a / 255);
    lum[p] = l;
    if (l > threshold) idx.push(p);
  }
  if (idx.length === 0) throw new Error('Маска пустая: нет светлых пикселей');

  const out = new Float32Array(count * 3);
  const aspect = w / h;
  let i = 0;
  let guard = 0;
  while (i < count && guard++ < count * 200) {
    const p = idx[(rand() * idx.length) | 0];
    const l = lum[p];
    if (rand() > l) continue; // яркие места плотнее
    const px = (p % w) + rand();
    const py = Math.floor(p / w) + rand();
    out[i * 3] = (px / w - 0.5) * 2 * aspect;
    out[i * 3 + 1] = -(py / h - 0.5) * 2;
    // объём: симметрично вокруг плоскости, толщина растёт с яркостью
    out[i * 3 + 2] = (rand() * 2 - 1) * l * depth;
    i++;
  }
  return normalize(out);
}

/** Сердце для hero: маска, если она есть и разрешена конфигом, иначе процедурное. */
export async function heartShape(count: number): Promise<{ points: ShapePoints; source: 'mask' | 'procedural' }> {
  const mode = config.heart.source;
  if (mode !== 'procedural') {
    try {
      const img = await loadImage(`${import.meta.env.BASE_URL}shapes/heart.png`);
      return { points: shapeFromMask(img, count, { depth: config.heart.maskDepth }), source: 'mask' };
    } catch (err) {
      if (mode === 'mask') console.warn('[pulse] heart.png не загрузилась, беру процедурное сердце', err);
    }
  }
  return { points: proceduralHeart(count), source: 'procedural' };
}
