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
import { initCta } from './ui/cta';
import { initPreloader } from './ui/preloader';
import { initEcgProgress } from './ui/ecgProgress';
import { initSound } from './ui/sound';
import { gsap } from 'gsap';
import type { Anchor, ShapeName } from './gl/shapes';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Центр сцены каждого экрана в момент, когда экран стоит в кадре (его верх = верх окна). */
function measureAnchors(): Partial<Record<ShapeName, Anchor>> {
  const out: Partial<Record<ShapeName, Anchor>> = {};
  // в координатах холста сцены (на телефоне он выше видимой области — 100lvh)
  const gl = document.getElementById('gl');
  const vw = gl?.clientWidth || window.innerWidth, vh = gl?.clientHeight || window.innerHeight;
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

/**
 * «Уменьшить движение» в системе: формы стоят спокойно — без вихрей, дрейфа, покачивания,
 * отталкивания курсором и вспышек; при прокрутке формы сменяются плавным наплывом.
 */
if (reduced) {
  config.noise.strength = 0;
  config.morph.swirl = 0;
  config.morph.spread = 0.4;
  config.mouse.strength = 0;
  config.mouse.tilt = 0;
  config.heart.swayAmplitude = 0;
  config.beat.scale = 0;
  config.flash.push = 0;
  config.flash.intensity = 0.4;
  for (const s of Object.values(config.shapes)) s.drift = 0;
}

async function boot(): Promise<void> {
  // Прелоадер — первым: линия ЭКГ рисуется, пока грузятся шрифты и строятся формы
  const preloader = initPreloader(reduced);
  initIcons();
  initLiveCounter(reduced);

  // Разбивка на строки зависит от шрифта — ждём его
  await document.fonts.ready;
  const reveal = initTextReveal(reduced);
  const counters = initCounters(reduced);

  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const scene = new Scene(canvas);
  scene.reducedMotion = reduced;
  scene.onStart = (t) => syncBeat(t);

  const particles = new Particles(particleCount());
  particles.onTouch = () => counters.start();
  scene.setParticles(particles);
  particles.setAnchors(measureAnchors());
  await particles.buildAll();
  particles.setIntro(0); // все точки собраны в одну — до вспышки прелоадера
  scene.start();
  initSound(() => scene.startedAt);

  // Счётчик дошёл до 100 → линия сжимается в точку → вспышка → частицы разлетаются в сердце, потом заголовок
  void preloader.finish(Promise.resolve(), (x, y) => {
    const intro = { v: 0 };
    gsap.to(intro, { v: 1, duration: reduced ? 0.01 : 2.6, ease: 'none', onUpdate: () => particles.setIntro(intro.v, x, y) });
    gsap.delayedCall(reduced ? 0 : 0.7, () => reveal.playHero());
  });

  const peopleEl = document.getElementById('people');
  const setEcgProgress = initEcgProgress(6);
  const scroll = initScroll((p) => {
    particles.scroll = p;
    setEcgProgress(window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
    if (peopleEl) particles.peopleLift = Math.max(0, -peopleEl.getBoundingClientRect().top / window.innerHeight);
    scene.post.uniforms.uScroll.value = p;
  }, reduced);
  ScrollTrigger.addEventListener('refresh', () => particles.setAnchors(measureAnchors()));
  initNav();
  // Этап 7: волна от кнопки по частицам и по экрану, затем «Ты — точка № 48 001» и новая точка в кольце
  initCta({
    reduced,
    onJoin: () => {
      particles.flash(particles.ringCenter());
      particles.joined = true;
    },
  });
  // Экран 4 без остановки: руки тянутся, как только блок въезжает в кадр, касаются, когда заголовок
  // доходит до верха, и сливаются в сердце, пока блок уезжает дальше
  const people = document.getElementById('people');
  if (people)
    ScrollTrigger.create({
      trigger: people,
      start: 'top 95%',
      end: 'top -15%',
      onUpdate: (self) => (particles.peopleProgress = self.progress),
      onRefresh: (self) => (particles.peopleProgress = self.progress),
    });
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

boot().catch((err) => {
  console.error('[pulse] не удалось запустить сцену', err);
  // текст сайта должен остаться доступным, даже если сцена не запустилась
  document.getElementById('preloader')?.setAttribute('hidden', '');
  document.documentElement.classList.remove('is-loading');
});
