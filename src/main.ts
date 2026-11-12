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

const isMobile = () => window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const particleCount = () => (isMobile() ? config.particles.countMobile : config.particles.countDesktop);

async function boot(): Promise<void> {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const scene = new Scene(canvas);

  const particles = new Particles(particleCount());
  scene.setParticles(particles);
  await particles.buildAll();
  scene.start();

  const scroll = initScroll((p) => {
    particles.scroll = p;
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
