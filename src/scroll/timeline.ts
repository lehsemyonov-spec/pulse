import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { config } from '../config';

gsap.registerPlugin(ScrollTrigger);

/**
 * Плавный скролл (Lenis) + главная ScrollTrigger-таймлайн.
 * Отдаёт позицию p в «экранах»: 0 — верх экрана 1 (hero), 5 — верх экрана 6.
 * Считается по реальным offsetTop секций, поэтому секции могут быть разной высоты.
 */
export function initScroll(onProgress: (p: number) => void): { lenis: Lenis; goTo: (screen: number) => void } {
  const lenis = new Lenis({ lerp: config.scroll.lerp, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.options.lerp = config.scroll.lerp;
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  const sections = [...document.querySelectorAll<HTMLElement>('[data-shape]')];
  let anchors: number[] = [];
  const measure = () => {
    anchors = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
  };

  const toScreens = (y: number): number => {
    const last = anchors.length - 1;
    if (y <= anchors[0]) return 0;
    if (y >= anchors[last]) return last;
    let i = 0;
    while (i < last - 1 && y >= anchors[i + 1]) i++;
    return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
  };

  ScrollTrigger.addEventListener('refreshInit', measure);
  measure();

  ScrollTrigger.create({
    trigger: document.documentElement,
    start: 0,
    end: 'max',
    onUpdate: () => onProgress(toScreens(lenis.scroll)),
    onRefresh: () => onProgress(toScreens(lenis.scroll)),
  });
  onProgress(toScreens(window.scrollY));

  return {
    lenis,
    goTo: (screen: number) => lenis.scrollTo(sections[Math.max(0, Math.min(sections.length - 1, screen))], { duration: 2.2 }),
  };
}
