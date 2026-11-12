import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  Matrix4,
  PerspectiveCamera,
  Points,
  QuadraticBezierCurve3,
  ShaderMaterial,
  Vector3,
} from 'three';
import { config } from '../config';
import { beatPeriod } from '../core/beat';
import { mulberry32, type Anchor, type ShapePoints } from './shapes';

const ACCENT = new Color('#B8F26A');
const CREAM = new Color('#F4EFEA');
const SEGMENTS = 64;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3); // easeOutCubic
const range = (q: number, a: number, b: number) => clamp01((q - a) / (b - a));

/* ---------- Шейдеры: нить, точки волонтёров, точка-просьба ---------- */

const lineVert = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const lineFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uDraw;    // 0–1: сколько нити нарисовано (от волонтёра к просьбе)
  uniform float uPulse;   // положение бегущего импульса
  uniform float uAlpha;
  varying float vT;
  void main() {
    if (vT > uDraw) discard;
    float head = exp(-pow((vT - uDraw) * 18.0, 2.0)) * step(uDraw, 0.999); // светлая «голова» нити, пока она тянется
    float pulse = exp(-pow((vT - uPulse) * 14.0, 2.0)) * step(0.999, uDraw); // импульс, когда нить дотянулась
    float a = (0.38 + head * 1.6 + pulse * 1.4) * uAlpha;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

const dotVert = /* glsl */ `
  attribute float aLit;     // 0–1 по каждой точке
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vLit;
  void main() {
    vLit = aLit;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (0.6 + 0.4 * aLit);
  }
`;
const dotFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uCream;
  uniform float uAlpha;
  varying float vLit;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    core = core * core;
    float ring = smoothstep(0.08, 0.0, abs(d - 0.36)) * 0.5;
    vec3 c = mix(uCream, uAccent, vLit);
    gl_FragColor = vec4(c * (core * (0.35 + 0.9 * vLit) + ring * vLit) * uAlpha, 1.0);
  }
`;

// Точка-просьба: ядро + кольца, расходящиеся в ритме «ту-дум»
const requestVert = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uSize;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPixelRatio;
  }
`;
const requestFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uPeriod;
  uniform float uShow;     // появление 0–1
  uniform float uMeet;     // вспышка встречи 0–1
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;           // 0 в центре, 1 на краю
    if (d > 1.0) discard;
    float core = exp(-d * d * 140.0) * 1.1 + exp(-d * d * 22.0) * 0.22;
    // два кольца на каждый удар: «ту» и «дум»
    float ph1 = fract(uTime / uPeriod);
    float ph2 = fract((uTime - 0.28) / uPeriod);
    float r1 = smoothstep(0.03, 0.0, abs(d - ph1 * 0.95)) * (1.0 - ph1) * 0.8;
    float r2 = smoothstep(0.03, 0.0, abs(d - ph2 * 0.75)) * (1.0 - ph2) * 0.6;
    float meet = exp(-d * d * 30.0) * uMeet * 0.7;
    float a = (core + (r1 + r2) * 0.9 + meet) * uShow;
    gl_FragColor = vec4(uAccent * a, 1.0);
  }
`;

/**
 * Экран 3: на карте вспыхивает просьба, от ближайших волонтёров к ней тянутся нити,
 * один волонтёр едет по своей нити — встреча. Всё в координатах облака
 * (дочерний объект Points), поэтому стоит ровно на улицах карты.
 */
export class CityOverlay {
  readonly group = new Group();
  private lines: Line<BufferGeometry, ShaderMaterial>[] = [];
  private curves: QuadraticBezierCurve3[] = [];
  private dots: Points<BufferGeometry, ShaderMaterial> | null = null;
  private walker: Points<BufferGeometry, ShaderMaterial> | null = null;
  private request: Points<BufferGeometry, ShaderMaterial> | null = null;
  /** Прогресс сценария экрана 3 по скроллу, 0–1 */
  progress = 0;
  /** Видимость: совпадает с тем, насколько облако сейчас в форме карты */
  visible = 0;

  constructor() {
    this.group.renderOrder = 2;
  }

  /**
   * Выбрать точку-просьбу и волонтёров на карте.
   * Просьба — точка улицы, ближайшая к центру сцены экрана 3 на экране;
   * волонтёры — точки улиц вокруг неё, по одной в каждом секторе, чтобы нити шли с разных сторон.
   */
  build(city: ShapePoints, anchor: Anchor | undefined, scale: number, camera: PerspectiveCamera): void {
    this.clear();
    const count = city.length / 3;
    const toScreen = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(new Matrix4().makeScale(scale, scale, scale));
    const aspect = camera.aspect;
    const ndc = new Float32Array(count * 2);
    const v = new Vector3();
    for (let i = 0; i < count; i++) {
      v.set(city[i * 3], city[i * 3 + 1], city[i * 3 + 2]).applyMatrix4(toScreen);
      ndc[i * 2] = v.x;
      ndc[i * 2 + 1] = v.y;
    }

    // просьба: ближе всего к центру сцены, чуть выше середины (там читается лучше)
    const ax = anchor?.x ?? 0, ay = (anchor?.y ?? 0) + 0.02;
    let req = 0, best = Infinity;
    for (let i = 0; i < count; i++) {
      const dx = (ndc[i * 2] - ax) * aspect, dy = ndc[i * 2 + 1] - ay;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; req = i; }
    }
    const rx = ndc[req * 2], ry = ndc[req * 2 + 1];
    const reqPos = new Vector3(city[req * 3], city[req * 3 + 1], city[req * 3 + 2]);

    // волонтёры: по сектору, на расстоянии от rMin до rMax (в долях высоты экрана)
    const o = config.cityOverlay;
    const rand = mulberry32(17);
    const sectors = o.volunteers;
    const pick: number[] = new Array(sectors).fill(-1);
    const target = Array.from({ length: sectors }, () => o.rMin + rand() * (o.rMax - o.rMin));
    const score: number[] = new Array(sectors).fill(Infinity);
    for (let i = 0; i < count; i++) {
      const dx = (ndc[i * 2] - rx) * aspect, dy = ndc[i * 2 + 1] - ry;
      const d = Math.hypot(dx, dy);
      if (d < o.rMin || d > o.rMax) continue;
      if (Math.abs(ndc[i * 2]) > 0.92 || Math.abs(ndc[i * 2 + 1]) > 0.92) continue;
      const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
      const s = Math.min(sectors - 1, Math.floor(a * sectors));
      const sc = Math.abs(d - target[s]);
      if (sc < score[s]) { score[s] = sc; pick[s] = i; }
    }
    const vols = pick.filter((i) => i >= 0);
    // ближайший — тот, кто поедет на встречу; порядок появления нитей — от ближних к дальним
    vols.sort((a, b) => Math.hypot(ndc[a * 2] - rx, ndc[a * 2 + 1] - ry) - Math.hypot(ndc[b * 2] - rx, ndc[b * 2 + 1] - ry));

    // нити: дуги над картой, от волонтёра к просьбе
    for (const i of vols) {
      const from = new Vector3(city[i * 3], city[i * 3 + 1], city[i * 3 + 2]);
      const len = from.distanceTo(reqPos);
      const mid = from.clone().add(reqPos).multiplyScalar(0.5).add(new Vector3(0, len * o.lift, len * o.lift * 0.6));
      const curve = new QuadraticBezierCurve3(from, mid, reqPos.clone());
      this.curves.push(curve);
      const pts = curve.getPoints(SEGMENTS);
      const g = new BufferGeometry().setFromPoints(pts);
      const t = new Float32Array(pts.length);
      for (let k = 0; k < pts.length; k++) t[k] = k / (pts.length - 1);
      g.setAttribute('aT', new BufferAttribute(t, 1));
      const m = new ShaderMaterial({
        vertexShader: lineVert,
        fragmentShader: lineFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uColor: { value: ACCENT }, uDraw: { value: 0 }, uPulse: { value: 0 }, uAlpha: { value: 0 } },
      });
      const line = new Line(g, m);
      line.frustumCulled = false;
      this.lines.push(line);
      this.group.add(line);
    }

    // точки волонтёров
    const dg = new BufferGeometry();
    const pos = new Float32Array(vols.length * 3);
    vols.forEach((i, k) => pos.set([city[i * 3], city[i * 3 + 1], city[i * 3 + 2]], k * 3));
    dg.setAttribute('position', new BufferAttribute(pos, 3));
    dg.setAttribute('aLit', new BufferAttribute(new Float32Array(vols.length), 1));
    dg.setAttribute('aSize', new BufferAttribute(new Float32Array(vols.length).fill(o.dotSize), 1));
    this.dots = new Points(dg, this.dotMaterial());
    this.dots.frustumCulled = false;
    this.group.add(this.dots);

    // волонтёр, который едет на встречу
    const wg = new BufferGeometry();
    wg.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
    wg.setAttribute('aLit', new BufferAttribute(new Float32Array([1]), 1));
    wg.setAttribute('aSize', new BufferAttribute(new Float32Array([o.dotSize * 1.3]), 1));
    this.walker = new Points(wg, this.dotMaterial());
    this.walker.frustumCulled = false;
    this.group.add(this.walker);

    // просьба
    const qg = new BufferGeometry();
    qg.setAttribute('position', new BufferAttribute(new Float32Array([reqPos.x, reqPos.y, reqPos.z]), 3));
    this.request = new Points(
      qg,
      new ShaderMaterial({
        vertexShader: requestVert,
        fragmentShader: requestFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uAccent: { value: ACCENT },
          uPixelRatio: { value: 1 },
          uSize: { value: o.requestSize },
          uTime: { value: 0 },
          uPeriod: { value: beatPeriod() },
          uShow: { value: 0 },
          uMeet: { value: 0 },
        },
      }),
    );
    this.request.frustumCulled = false;
    this.group.add(this.request);
  }

  private dotMaterial(): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader: dotVert,
      fragmentShader: dotFrag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uAccent: { value: ACCENT }, uCream: { value: CREAM }, uPixelRatio: { value: 1 }, uAlpha: { value: 0 } },
    });
  }

  /**
   * Сценарий по прогрессу q (0–1):
   *   0,00–0,30 — «Просьба»: вспыхивает точка, расходятся кольца;
   *   0,30–0,65 — «Отклик»: по очереди тянутся нити, загораются волонтёры;
   *   0,65–1,00 — «Встреча»: ближайший волонтёр едет по нити, вспышка, остальные гаснут.
   */
  update(time: number, pixelRatio: number): void {
    const q = this.progress;
    const vis = this.visible;
    this.group.visible = vis > 0.001;
    if (!this.group.visible || !this.request || !this.dots || !this.walker) return;

    const show = ease(range(q, 0.02, 0.18));
    const respond = range(q, 0.3, 0.62);
    const meet = range(q, 0.68, 0.94);
    const n = this.lines.length;

    // просьба
    const ru = this.request.material.uniforms;
    ru.uTime.value = time;
    ru.uPeriod.value = beatPeriod();
    ru.uPixelRatio.value = pixelRatio;
    ru.uShow.value = show * vis;
    ru.uMeet.value = range(meet, 0.8, 1); // волонтёр дошёл — просьба светится ярче: «встреча»

    // нити и волонтёры: нить k стартует в свою очередь
    const lit = this.dots.geometry.getAttribute('aLit') as BufferAttribute;
    for (let k = 0; k < n; k++) {
      const start = (k / n) * 0.55;
      const draw = ease(range(respond, start, start + 0.45));
      const m = this.lines[k].material.uniforms;
      m.uDraw.value = draw;
      m.uPulse.value = (time * 0.7 + k * 0.37) % 1;
      // во время встречи гаснут все нити, кроме первой (по ней едет волонтёр)
      const fade = k === 0 ? 1 : 1 - meet * 0.85;
      m.uAlpha.value = vis * fade;
      let l = draw > 0 ? 0.25 + 0.75 * Math.min(1, draw * 3) : 0;
      if (k === 0) l *= 1 - meet; // первый волонтёр уехал — его место пустеет
      lit.setX(k, l);
    }
    lit.needsUpdate = true;
    const du = this.dots.material.uniforms;
    du.uPixelRatio.value = pixelRatio;
    du.uAlpha.value = vis * show;

    // волонтёр едет по первой нити
    const wu = this.walker.material.uniforms;
    wu.uPixelRatio.value = pixelRatio;
    wu.uAlpha.value = meet > 0 && meet < 1 ? vis : 0; // на финише сливается с просьбой
    if (this.curves[0]) {
      const p = this.curves[0].getPoint(ease(meet));
      (this.walker.geometry.getAttribute('position') as BufferAttribute).setXYZ(0, p.x, p.y, p.z);
      this.walker.geometry.getAttribute('position').needsUpdate = true;
    }
  }

  private clear(): void {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      const m = o as Points | Line;
      m.geometry.dispose();
      (m.material as ShaderMaterial).dispose();
    }
    this.lines = [];
    this.curves = [];
    this.dots = this.walker = this.request = null;
  }
}
