// Шрифты локально (WOFF2 через @fontsource): Manrope 300–500, Cormorant Garamond Italic, JetBrains Mono 400.
import '@fontsource/manrope/300.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/jetbrains-mono/400.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/sections.css';

import { config } from './config';
import { Scene } from './gl/Scene';
import { Particles } from './gl/Particles';
import { initScroll } from './scroll/timeline';
import { initTextReveal } from './ui/textReveal';
import { initCounters, initLiveCounter } from './ui/counters';
import { initIcons } from './ui/icons';
import { syncBeat } from './ui/beatSync';
import { initNav } from './ui/nav';
import { initCalc } from './ui/calc';
import type { Anchor, ShapeName } from './gl/shapes';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Центр сцены каждого экрана в момент, когда экран стоит в кадре (его верх = верх окна). */
function measureAnchors(): Partial<Record<ShapeName, Anchor>> {
  const out: Partial<Record<ShapeName, Anchor>> = {};
  const vw = window.innerWidth, vh = window.innerHeight;
  for (const section of document.querySelectorAll<HTMLElement>('[data-shape]')) {
    const stage = section.querySelector<HTMLElement>('.screen__stage');
    if (!stage) continue;
    const s = section.getBoundingClientRect();
    const r = stage.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top - s.top + r.height / 2;
    out[section.dataset.shape as ShapeName] = { x: (2 * cx) / vw - 1, y: 1 - (2 * cy) / vh, h: r.height / vh };
  }
  return out;
}

const isMobile = () => window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const particleCount = () => (isMobile() ? config.particles.countMobile : config.particles.countDesktop);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function boot(): Promise<void> {
  initIcons();
  initLiveCounter(reduced);

  // Разбивка на строки зависит от шрифта — ждём его
  await document.fonts.ready;
  const reveal = initTextReveal(reduced);
  const counters = initCounters(reduced);

  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const scene = new Scene(canvas);
  scene.onStart = (t) => syncBeat(t);

  const particles = new Particles(particleCount());
  particles.onTouch = () => counters.start();
  scene.setParticles(particles);
  particles.setAnchors(measureAnchors());
  await particles.buildAll();
  scene.start();
  reveal.playHero();

  const scroll = initScroll((p) => {
    particles.scroll = p;
    scene.post.uniforms.uScroll.value = p;
  });
  ScrollTrigger.addEventListener('refresh', () => particles.setAnchors(measureAnchors()));
  initNav();
  // Экран 5: калькулятор зажигает столько групп-созвездий, сколько людей получат помощь;
  // выбранные навыки начинают пульсировать — их анимацию выравниваем по ритму частиц
  initCalc((people) => {
    particles.highlightTarget = people;
    requestAnimationFrame(() => syncBeat(scene.startedAt));
  });

  // Для автоматических скриншотов в dev: мгновенный переход к позиции
  if (import.meta.env.DEV) Object.assign(window, { __pulse: { particles, lenis: scroll.lenis } });

  // Панель параметров: ?debug в адресе или клавиша D (в окне чата адрес не поменять)
  let debugLoaded = false;
  const openDebug = async () => {
    if (debugLoaded) return;
    debugLoaded = true;
    const { initDebug } = await import('./debug');
    initDebug(scene, particles, scroll.goTo, particleCount);
  };
  if (new URLSearchParams(location.search).has('debug')) void openDebug();
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'd' || e.key === 'в') && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) void openDebug();
  });
}

boot().catch((err) => console.error('[pulse] не удалось запустить сцену', err));
