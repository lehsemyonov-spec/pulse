import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Границы шагов по прогрессу экрана 3 — те же, что в CityOverlay.update */
const BOUNDS = [0, 0.3, 0.65, 1];

/**
 * Экран 3 закреплён, пока его прокручивают; прогресс 0–1 ведёт и сценарий на карте,
 * и шаги слева: активный подсвечен, его полоска заполняется.
 */
export function initHowSteps(onProgress: (q: number) => void): void {
  const section = document.getElementById('how');
  const steps = [...document.querySelectorAll<HTMLElement>('#how .step')];
  if (!section || !steps.length) return;

  const render = (q: number) => {
    steps.forEach((el, i) => {
      const a = BOUNDS[i], b = BOUNDS[i + 1];
      const fill = Math.min(1, Math.max(0, (q - a) / (b - a)));
      el.style.setProperty('--fill', fill.toFixed(3));
      el.classList.toggle('is-active', q >= a && (q < b || (i === steps.length - 1 && q >= b)));
      el.classList.toggle('is-done', q >= b && i < steps.length - 1);
    });
    onProgress(q);
  };

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => render(self.progress),
    onRefresh: (self) => render(self.progress),
  });
  render(0);
}
