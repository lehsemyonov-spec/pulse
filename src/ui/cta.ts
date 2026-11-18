import { gsap } from 'gsap';
import { formatNumber } from './plural';

/**
 * Этап 7: «Стать частью пульса».
 * Нажатие → волна по частицам от кнопки + салатовая волна заливает экран → она растворяется,
 * и вместо вопроса — «Ты — точка № 48 001. Спасибо, что ты здесь.», а в центре кольца
 * загорается новая точка. Никаких форм и данных: только анимация (BRIEF, 152-ФЗ).
 */
export function initCta(opts: { reduced: boolean; onJoin: () => void }): void {
  const btn = document.querySelector<HTMLButtonElement>('.cta');
  const wave = document.querySelector<HTMLElement>('.wave');
  const ask = document.querySelector<HTMLElement>('.final__ask');
  const joined = document.querySelector<HTMLElement>('.final__joined');
  const volunteers = document.querySelector<HTMLElement>('[data-count="48000"]');
  if (!btn || !wave || !ask || !joined) return;

  let done = false;
  btn.addEventListener('click', () => {
    if (done) return;
    done = true;
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    wave.style.setProperty('--x', `${x}px`);
    wave.style.setProperty('--y', `${y}px`);
    // радиус, которым круг из точки нажатия закрывает весь экран
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const swap = () => {
      ask.hidden = true;
      joined.hidden = false;
      btn.hidden = true;
      // нас стало на одного больше
      if (volunteers) {
        volunteers.dataset.count = '48001';
        volunteers.textContent = formatNumber(48001);
      }
      opts.onJoin();
    };

    if (opts.reduced) {
      swap();
      return;
    }

    const tl = gsap.timeline();
    tl.to(btn, { scale: 0.92, duration: 0.18, ease: 'quart.out' })
      .to(btn, { scale: 1, duration: 0.5, ease: 'expo.out' })
      // волна закрывает экран из центра кнопки
      .set(wave, { opacity: 1 }, 0.1)
      .fromTo(wave, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)`, duration: 0.9, ease: 'expo.inOut' }, 0.1)
      .call(swap, [], 0.95)
      // и растворяется, открывая экран «Ты — точка»
      .to(wave, { opacity: 0, duration: 1.1, ease: 'quart.out' }, 1.05)
      .from(joined, { y: 24, opacity: 0, filter: 'blur(8px)', duration: 1.2, ease: 'expo.out' }, 1.1)
      .set(wave, { clipPath: 'circle(0px at 50% 50%)' });
  });
}
