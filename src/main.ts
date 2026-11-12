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
import { heartShape } from './gl/shapes';

const isMobile = () => window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const particleCount = () => (isMobile() ? config.particles.countMobile : config.particles.countDesktop);

async function boot(): Promise<void> {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const scene = new Scene(canvas);

  const { points, source } = await heartShape(particleCount());
  const particles = new Particles(points);
  scene.setParticles(particles);
  scene.start();
  document.documentElement.dataset.heart = source;

  if (new URLSearchParams(location.search).has('debug')) {
    const { initDebug } = await import('./debug');
    initDebug(scene, async () => {
      const next = await heartShape(particleCount());
      particles.setShape(next.points);
      document.documentElement.dataset.heart = next.source;
    });
  }
}

boot().catch((err) => console.error('[pulse] не удалось запустить сцену', err));
