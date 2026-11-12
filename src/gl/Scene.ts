import { Color, PerspectiveCamera, Scene as ThreeScene, Timer, Vector2, Vector3, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { config } from '../config';
import { Particles } from './Particles';
import postFrag from './shaders/post.frag?raw';

const BG = '#0B0A0D';
const CAMERA_Z = 6;
const FOV = 35;

function hexToVec3(hex: string): Vector3 {
  const n = parseInt(hex.slice(1), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Рендерер, камера, постобработка (bloom → зерно и виньетка), resize, пауза во фоне. */
export class Scene {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  readonly scene = new ThreeScene();
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly post: ShaderPass;
  readonly stats = { fps: 0 };
  /** Момент старта часов (performance.now) — от него считается ритм удара */
  startedAt = 0;
  onStart: ((startedAt: number) => void) | null = null;
  /** Вызывается каждый кадр перед отрисовкой: (время, pixel ratio) */
  onFrame: ((time: number, pixelRatio: number) => void) | null = null;

  private particles: Particles | null = null;
  private timer = new Timer();
  private running = false;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.scene.background = new Color(BG);

    this.camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAMERA_Z);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), config.bloom.strength, config.bloom.radius, config.bloom.threshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.post = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uGrain: { value: config.post.grain },
        uVignette: { value: config.post.vignette },
        // sRGB-значения как есть: проход идёт после OutputPass
        uBg: { value: hexToVec3(BG) },
        uResolution: { value: new Vector2(1, 1) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: postFrag,
    });
    this.composer.addPass(this.post);

    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('blur', this.onPointerLeave);
    this.timer.connect(document);
  }

  setParticles(p: Particles): void {
    if (this.particles) this.scene.remove(this.particles.points);
    this.particles = p;
    this.scene.add(p.points);
    this.fitParticles();
  }

  /** Видимая ширина и высота на плоскости z = 0. */
  private viewSize(): { w: number; h: number } {
    const h = 2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360);
    return { w: h * this.camera.aspect, h };
  }

  private fitParticles(): void {
    if (!this.particles) return;
    const { w, h } = this.viewSize();
    this.particles.fit(w, h);
  }

  resize = (): void => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, config.render.maxPixelRatio);

    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
    this.post.uniforms.uResolution.value.set(this.width, this.height);

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.fitParticles();
  };

  private onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private onPointer = (e: PointerEvent): void => {
    const x = (e.clientX / this.width) * 2 - 1;
    const y = -(e.clientY / this.height) * 2 + 1;
    this.particles?.setPointer(x, y, true);
  };

  private onPointerLeave = (): void => {
    this.particles?.setPointer(0, 0, false);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer.reset();
    this.startedAt = performance.now();
    this.renderer.setAnimationLoop(this.tick);
    this.onStart?.(this.startedAt);
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private tick = (timestamp: number): void => {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 1 / 20);
    const time = this.timer.getElapsed();

    this.bloom.strength = config.bloom.strength;
    this.bloom.radius = config.bloom.radius;
    this.bloom.threshold = config.bloom.threshold;
    this.post.uniforms.uTime.value = time;
    this.post.uniforms.uGrain.value = config.post.grain;
    this.post.uniforms.uVignette.value = config.post.vignette;

    this.particles?.update(time, delta, this.pixelRatio, this.camera.aspect);
    this.onFrame?.(time, this.pixelRatio);
    this.composer.render(delta);

    this.fpsAcc += delta;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.stats.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  };
}
