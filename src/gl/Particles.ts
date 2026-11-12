import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector2,
} from 'three';
import { config } from '../config';
import { beatPeriod } from '../core/beat';
import { mulberry32, type ShapePoints } from './shapes';
import noise from './shaders/noise.glsl?raw';
import vertexShader from './shaders/particles.vert?raw';
import fragmentShader from './shaders/particles.frag?raw';

/**
 * Одно облако THREE.Points. Сейчас держит одну форму (сердце);
 * на этапе 3 сюда добавятся пара форм «из/в», uProgress и aDelay.
 */
export class Particles {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly material: ShaderMaterial;
  private geometry: BufferGeometry;

  /** Курсор: цель и сглаженное значение в NDC */
  private mouseTarget = new Vector2(0, 0);
  private mouse = new Vector2(0, 0);
  private mouseActiveTarget = 0;

  constructor(shape: ShapePoints) {
    this.geometry = Particles.buildGeometry(shape);

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
        uCoralRatio: { value: config.particles.coralRatio },
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
        uColorCream: { value: new Color('#F4EFEA') },
        uColorCoral: { value: new Color('#FF5A4E') },
      },
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  private static buildGeometry(shape: ShapePoints): BufferGeometry {
    const count = shape.length / 3;
    const rand = mulberry32(48001);
    const random = new Float32Array(count * 4);
    for (let i = 0; i < random.length; i++) random[i] = rand();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(shape, 3));
    g.setAttribute('aRandom', new BufferAttribute(random, 4));
    return g;
  }

  /** Заменить форму целиком (например, после смены числа частиц в debug). */
  setShape(shape: ShapePoints): void {
    const old = this.geometry;
    this.geometry = Particles.buildGeometry(shape);
    this.points.geometry = this.geometry;
    old.dispose();
  }

  /** Вписать форму (высота 2) в видимую область на z = 0. */
  fit(viewWidth: number, viewHeight: number): void {
    const byHeight = (viewHeight * config.heart.fill) / 2;
    const byWidth = (viewWidth * 0.82) / 2.4; // ширина сердца ≈ 1,2 × высоты
    this.points.scale.setScalar(Math.min(byHeight, byWidth));
  }

  setPointer(ndcX: number, ndcY: number, active: boolean): void {
    this.mouseTarget.set(ndcX, ndcY);
    this.mouseActiveTarget = active ? 1 : 0;
  }

  update(time: number, delta: number, pixelRatio: number, aspect: number): void {
    const u = this.material.uniforms;
    const p = config.particles;

    u.uTime.value = time;
    u.uPixelRatio.value = pixelRatio;
    u.uAspect.value = aspect;

    // параметры читаем из config каждый кадр — так lil-gui работает без обвязки
    u.uSize.value = p.size;
    u.uBrightness.value = p.brightness;
    u.uCoralRatio.value = p.coralRatio;
    u.uDepthFade.value = p.depthFade;
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

    // курсор с инерцией, не зависящей от fps
    const k = 1 - Math.pow(1 - config.mouse.ease, delta * 60);
    this.mouse.lerp(this.mouseTarget, k);
    u.uMouseActive.value += (this.mouseActiveTarget - u.uMouseActive.value) * k * 0.6;

    // медленное покачивание + наклон за курсором
    const h = config.heart;
    const rotY = Math.sin(time * h.swaySpeed) * h.swayAmplitude + this.mouse.x * config.mouse.tilt;
    const rotX = -this.mouse.y * config.mouse.tilt * 0.6;
    this.points.rotation.y = rotY;
    this.points.rotation.x += (rotX - this.points.rotation.x) * k;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
