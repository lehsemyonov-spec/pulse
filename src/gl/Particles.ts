import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { config } from '../config';
import { beatPeriod } from '../core/beat';
import { buildShape, CONSTELLATION_DUST, mulberry32, RESPONSIVE, SHAPE_ORDER, type Anchor, type ShapeName, type ShapePoints, type View } from './shapes';
import noise from './shaders/noise.glsl?raw';
import vertexShader from './shaders/particles.vert?raw';
import fragmentShader from './shaders/particles.frag?raw';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Одно облако THREE.Points. В геометрии всегда две формы: «из» (position) и «в» (aTo).
 * Скролл задаёт позицию p (экран 1 = 0, экран 6 = 5): целая часть выбирает пару форм,
 * дробная — прогресс перелёта. На границе экрана пара меняется — без скачка, потому что
 * в конце перехода i→i+1 и в начале i+1→i+2 точки стоят в одной и той же форме.
 */
export class Particles {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly material: ShaderMaterial;
  private geometry: BufferGeometry;
  private count: number;

  private shapes = new Map<ShapeName, ShapePoints>();
  private pair: [number, number] = [-1, -1];
  private view: View = { halfW: 1, halfH: 1 };
  private anchors: Partial<Record<ShapeName, Anchor>> = {};
  private viewSize: [number, number] = [1, 1];
  private rebuildTimer = 0;

  /** Позиция скролла в экранах и текущий прогресс */
  scroll = 0;
  private prevScroll = 0;
  /** Колбэк после пересборки форм (например, чтобы переставить нити на карте) */
  onBuilt: (() => void) | null = null;

  getShape(name: ShapeName): ShapePoints | undefined {
    return this.shapes.get(name);
  }

  getAnchor(name: ShapeName): Anchor | undefined {
    return this.anchors[name];
  }

  /** Насколько облако сейчас в форме name, 0–1 */
  weightOf(name: ShapeName): number {
    const { from, to, progress } = this.state;
    return (from === name ? 1 - progress : 0) + (to === name ? progress : 0);
  }

  /** Сколько групп созвездий должно гореть (экран 5, слайдер) */
  highlightTarget = 0;
  private highlight = 0;

  /** Колбэк касания рук — для синхронной реакции интерфейса */
  onTouch: (() => void) | null = null;
  readonly state = { p: 0, from: 'heart' as ShapeName, to: 'chaos' as ShapeName, progress: 0 };

  private mouseTarget = new Vector2(0, 0);
  private mouse = new Vector2(0, 0);
  private mouseActiveTarget = 0;

  constructor(count: number) {
    this.count = count;
    this.geometry = this.createGeometry(count);

    this.material = new ShaderMaterial({
      vertexShader: vertexShader.replace('#include <noise>', noise),
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uSize: { value: config.particles.size },
        uBrightness: { value: config.particles.brightness },
        uAccentRatio: { value: config.particles.accentRatio },
        uDepthFade: { value: config.particles.depthFade },
        uNoiseStrength: { value: config.noise.strength },
        uNoiseSpeed: { value: config.noise.speed },
        uNoiseScale: { value: config.noise.scale },
        uBeatPeriod: { value: beatPeriod() },
        uBeatScale: { value: config.beat.scale },
        uBeatSecond: { value: config.beat.second },
        uBeatGap: { value: config.beat.gap },
        uBeatWave: { value: config.beat.wave },
        uMouse: { value: this.mouse },
        uMouseActive: { value: 0 },
        uMouseRadius: { value: config.mouse.radius },
        uMouseStrength: { value: config.mouse.strength },
        uAspect: { value: 1 },
        uProgress: { value: 0 },
        uSpread: { value: config.morph.spread },
        uSwirl: { value: config.morph.swirl },
        uSwirlScale: { value: config.morph.swirlScale },
        uBeatAmount: { value: 1 },
        uDrift: { value: 0 },
        uNoiseAmount: { value: 1 },
        uShapeBrightness: { value: 1 },
        uHighlight: { value: 0 },
        uHighlightAmount: { value: 0 },
        uGapFrom: { value: 0 },
        uGapTo: { value: 0 },
        uFlashTime: { value: -100 },
        uFlashOrigin: { value: new Vector3() },
        uFlashSpeed: { value: config.flash.speed },
        uFlashPush: { value: config.flash.push },
        uFlashIntensity: { value: config.flash.intensity },
        uColorCream: { value: new Color('#F4EFEA') },
        uColorAccent: { value: new Color('#B8F26A') },
      },
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  private createGeometry(count: number): BufferGeometry {
    const rand = mulberry32(48001);
    const random = new Float32Array(count * 4);
    for (let i = 0; i < random.length; i++) random[i] = rand();
    const delay = new Float32Array(count);
    for (let i = 0; i < count; i++) delay[i] = rand();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aTo', new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aRandom', new BufferAttribute(random, 4));
    g.setAttribute('aDelay', new BufferAttribute(delay, 1));
    // группа созвездия: совпадает с порядком точек в constellations() из shapes.ts
    const group = new Float32Array(count);
    const dust = Math.floor(count * CONSTELLATION_DUST);
    const groups = config.constellations.groups;
    for (let i = 0; i < count; i++) group[i] = i < dust ? -1 : (i - dust) % groups;
    g.setAttribute('aGroup', new BufferAttribute(group, 1));
    return g;
  }

  /** Построить все формы. Вызывается при старте и при смене числа частиц. */
  async buildAll(count = this.count): Promise<void> {
    if (count !== this.count) {
      this.count = count;
      const old = this.geometry;
      this.geometry = this.createGeometry(count);
      this.points.geometry = this.geometry;
      old.dispose();
    }
    const built = await Promise.all(SHAPE_ORDER.map((n) => buildShape(n, this.count, this.view, this.anchors[n])));
    SHAPE_ORDER.forEach((n, i) => this.shapes.set(n, built[i]));
    this.updateFlashOrigin();
    this.pair = [-1, -1];
    this.applyPair();
    this.onBuilt?.();
  }

  /** Точка касания: середина между кончиками пальцев (точки рук с наименьшим |x|). */
  private updateFlashOrigin(): void {
    const hands = this.shapes.get('hands');
    if (!hands) return;
    const idx: number[] = [];
    for (let i = 0; i < hands.length / 3; i++) idx.push(i);
    idx.sort((a, b) => Math.abs(hands[a * 3]) - Math.abs(hands[b * 3]));
    const take = idx.slice(0, 60);
    const o = this.material.uniforms.uFlashOrigin.value as Vector3;
    o.set(0, 0, 0);
    for (const i of take) o.add(new Vector3(0, hands[i * 3 + 1], hands[i * 3 + 2]));
    o.multiplyScalar(1 / take.length);
  }

  /** Запустить вспышку касания (сама вызывается при сближении рук по скроллу). */
  flash(): void {
    this.material.uniforms.uFlashTime.value = this.material.uniforms.uTime.value;
  }

  /** Пересобрать одну форму (например, сердце после смены источника в debug). */
  async rebuild(names: ShapeName[]): Promise<void> {
    const built = await Promise.all(names.map((n) => buildShape(n, this.count, this.view, this.anchors[n])));
    names.forEach((n, i) => this.shapes.set(n, built[i]));
    if (names.includes('hands')) this.updateFlashOrigin();
    this.pair = [-1, -1];
    this.applyPair();
    this.onBuilt?.();
  }

  /** Центры сцен из вёрстки. Если сдвинулись — формы пересобираются (с задержкой, как при resize). */
  setAnchors(anchors: Partial<Record<ShapeName, Anchor>>): void {
    const changed = SHAPE_ORDER.some((n) => {
      const a = anchors[n], b = this.anchors[n];
      return Math.abs((a?.x ?? 0) - (b?.x ?? 0)) > 0.01 || Math.abs((a?.y ?? 0) - (b?.y ?? 0)) > 0.01;
    });
    this.anchors = anchors;
    this.fit(this.viewSize[0], this.viewSize[1]);
    if (changed && this.shapes.size) this.scheduleRebuild();
  }

  private scheduleRebuild(): void {
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => void this.rebuild(RESPONSIVE), 180);
  }

  /** Вписать облако в экран: сердце высотой 2 занимает config.heart.fill высоты. */
  fit(viewWidth: number, viewHeight: number): void {
    this.viewSize = [viewWidth, viewHeight];
    const byHeight = (viewHeight * config.heart.fill) / 2;
    const byWidth = (viewWidth * 0.82) / 2.4; // ширина сердца ≈ 1,2 × высоты
    // и не больше сцены hero: сердце не наезжает на заголовок и кнопки
    const stage = this.anchors.heart?.h ?? 1;
    const byStage = (viewHeight * stage * 0.92) / 2;
    const scale = Math.min(byHeight, byWidth, byStage);
    this.points.scale.setScalar(scale);
    const view = { halfW: viewWidth / 2 / scale, halfH: viewHeight / 2 / scale };
    const changed = Math.abs(view.halfW - this.view.halfW) > 0.02 || Math.abs(view.halfH - this.view.halfH) > 0.02;
    this.view = view;
    // формы во весь экран пересчитываем после того, как resize успокоится
    if (changed && this.shapes.size) this.scheduleRebuild();
  }

  private applyPair(): void {
    const n = SHAPE_ORDER.length;
    const p = Math.min(Math.max(this.scroll, 0), n - 1);
    const i = Math.min(Math.floor(p), n - 2);
    if (i === this.pair[0]) return;
    const from = this.shapes.get(SHAPE_ORDER[i]);
    const to = this.shapes.get(SHAPE_ORDER[i + 1]);
    if (!from || !to) return;
    const pos = this.geometry.getAttribute('position') as BufferAttribute;
    const aTo = this.geometry.getAttribute('aTo') as BufferAttribute;
    (pos.array as Float32Array).set(from);
    (aTo.array as Float32Array).set(to);
    pos.needsUpdate = true;
    aTo.needsUpdate = true;
    this.pair = [i, i + 1];
  }

  setPointer(ndcX: number, ndcY: number, active: boolean): void {
    this.mouseTarget.set(ndcX, ndcY);
    this.mouseActiveTarget = active ? 1 : 0;
  }

  update(time: number, delta: number, pixelRatio: number, aspect: number): void {
    const u = this.material.uniforms;
    const pc = config.particles;

    // --- морфинг по скроллу
    this.applyPair();
    const n = SHAPE_ORDER.length;
    const p = Math.min(Math.max(this.scroll, 0), n - 1);
    const [iFrom, iTo] = this.pair[0] < 0 ? [0, 1] : this.pair;
    const local = p - iFrom; // 0–1 внутри перехода
    const progress = smooth(config.morph.start, config.morph.end, local);
    const fromName = SHAPE_ORDER[iFrom];
    const toName = SHAPE_ORDER[iTo];
    Object.assign(this.state, { p, from: fromName, to: toName, progress });

    // характер формы плавно смешиваем между «из» и «в»
    const a = config.shapes[fromName];
    const b = config.shapes[toName];
    const mix = (k: keyof typeof a) => a[k] + (b[k] - a[k]) * progress;
    u.uProgress.value = progress;
    u.uShapeBrightness.value = mix('brightness');
    u.uBeatAmount.value = mix('beat');
    u.uNoiseAmount.value = mix('noise');
    u.uDrift.value = mix('drift');
    const sway = mix('sway');

    // руки сближаются по мере скролла
    const h = config.hands;
    const gap = h.gap * (1 - smooth(h.approachFrom, h.approachTo, p));
    u.uGapFrom.value = fromName === 'hands' ? gap : 0;
    u.uGapTo.value = toName === 'hands' ? gap : 0;
    // касание — когда руки сошлись при скролле вниз
    if (this.prevScroll < h.approachTo && p >= h.approachTo && p < h.approachTo + 0.5) {
      this.flash();
      this.onTouch?.();
    }
    this.prevScroll = p;
    // созвездия: подсветка плавно догоняет значение калькулятора
    const hk = 1 - Math.pow(1 - config.constellations.ease, delta * 60);
    this.highlight += (this.highlightTarget - this.highlight) * hk;
    u.uHighlight.value = this.highlight;
    u.uHighlightAmount.value = this.weightOf('constellations');
    u.uFlashSpeed.value = config.flash.speed;
    u.uFlashPush.value = config.flash.push;
    u.uFlashIntensity.value = config.flash.intensity;

    // --- общие параметры: читаем config каждый кадр, чтобы lil-gui работал без обвязки
    u.uTime.value = time;
    u.uPixelRatio.value = pixelRatio;
    u.uAspect.value = aspect;
    u.uSize.value = pc.size;
    u.uBrightness.value = pc.brightness;
    u.uAccentRatio.value = pc.accentRatio;
    u.uDepthFade.value = pc.depthFade;
    u.uNoiseStrength.value = config.noise.strength;
    u.uNoiseSpeed.value = config.noise.speed;
    u.uNoiseScale.value = config.noise.scale;
    u.uBeatPeriod.value = beatPeriod();
    u.uBeatScale.value = config.beat.scale;
    u.uBeatSecond.value = config.beat.second;
    u.uBeatGap.value = config.beat.gap;
    u.uBeatWave.value = config.beat.wave;
    u.uMouseRadius.value = config.mouse.radius;
    u.uMouseStrength.value = config.mouse.strength;
    u.uSpread.value = config.morph.spread;
    u.uSwirl.value = config.morph.swirl;
    u.uSwirlScale.value = config.morph.swirlScale;

    // курсор с инерцией, не зависящей от fps
    const k = 1 - Math.pow(1 - config.mouse.ease, delta * 60);
    this.mouse.lerp(this.mouseTarget, k);
    u.uMouseActive.value += (this.mouseActiveTarget - u.uMouseActive.value) * k * 0.6;

    // покачивание (только у сердца) + наклон за курсором
    const hc = config.heart;
    const rotY = Math.sin(time * hc.swaySpeed) * hc.swayAmplitude * sway + this.mouse.x * config.mouse.tilt;
    const rotX = -this.mouse.y * config.mouse.tilt * 0.6;
    this.points.rotation.y = rotY;
    this.points.rotation.x += (rotX - this.points.rotation.x) * k;
  }

  dispose(): void {
    clearTimeout(this.rebuildTimer);
    this.geometry.dispose();
    this.material.dispose();
  }
}
