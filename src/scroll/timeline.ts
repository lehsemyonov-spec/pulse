import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { config } from '../config';

gsap.registerPlugin(ScrollTrigger);

/**
 * Плавный скролл (Lenis) + главная ScrollTrigger-таймлайн.
 * Отдаёт позицию p в «экранах»: 0 — верх экрана 1 (hero), 5 — верх экрана 6.
 * Считается по реальным позициям секций. Если секция выше экрана (проблема, истории),
 * форма стоит на месте, пока её читают, и меняется только на последнем экране прокрутки —
 * когда следующая секция въезжает в кадр.
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
    const len = anchors[i + 1] - anchors[i];
    const vh = window.innerHeight;
    if (len <= vh) return i + (y - anchors[i]) / len;
    return i + Math.max(0, (y - (anchors[i + 1] - vh)) / vh);
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

  // Якорные ссылки — через Lenis, чтобы прокрутка была такой же плавной
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const target = document.querySelector(a.getAttribute('href')!);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target as HTMLElement, { duration: 2 });
  });

  return {
    lenis,
    goTo: (screen: number) => lenis.scrollTo(sections[Math.max(0, Math.min(sections.length - 1, screen))], { duration: 2.2 }),
  };
}
