import { gsap } from 'gsap';
import { formatNumber } from './plural';

/**
 * Этап 7: «Стать частью пульса» — и обратно.
 * Нажатие → волна по частицам от кнопки + салатовая волна заливает экран → она растворяется,
 * и вместо вопроса — «Ты — точка № 48 001. Спасибо, что ты здесь.», а в центре кольца
 * загорается новая точка. «Выйти из пульса» возвращает всё как было: точка гаснет,
 * снова вопрос и кнопка, счётчик — 48 000. Никаких форм и данных: только анимация (BRIEF, 152-ФЗ).
 */
export function initCta(opts: { reduced: boolean; onJoin: () => void; onLeave: () => void }): void {
  const btn = document.querySelector<HTMLButtonElement>('.cta');
  const wave = document.querySelector<HTMLElement>('.wave');
  const ask = document.querySelector<HTMLElement>('.final__ask');
  const joined = document.querySelector<HTMLElement>('.final__joined');
  const leave = document.querySelector<HTMLButtonElement>('.final__leave');
  const volunteers = document.querySelector<HTMLElement>('[data-count="48000"], [data-count="48001"]');
  if (!btn || !wave || !ask || !joined) return;

  let busy = false;
  const setVolunteers = (n: number) => {
    if (!volunteers) return;
    volunteers.dataset.count = String(n);
    volunteers.textContent = formatNumber(n);
  };

  btn.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    // радиус, которым круг из точки нажатия закрывает весь экран
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const swap = () => {
      ask.hidden = true;
      joined.hidden = false;
      btn.hidden = true;
      setVolunteers(48001); // нас стало на одного больше
      opts.onJoin();
    };

    if (opts.reduced) {
      swap();
      busy = false;
      leave?.focus();
      return;
    }

    const tl = gsap.timeline({ onComplete: () => { busy = false; } });
    tl.to(btn, { scale: 0.92, duration: 0.18, ease: 'quart.out' })
      .to(btn, { scale: 1, duration: 0.5, ease: 'expo.out' })
      // волна закрывает экран из центра кнопки
      .set(wave, { opacity: 1 }, 0.1)
      .fromTo(wave, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)`, duration: 0.9, ease: 'expo.inOut' }, 0.1)
      .call(swap, [], 0.95)
      // и растворяется, открывая экран «Ты — точка»
      .to(wave, { opacity: 0, duration: 1.1, ease: 'quart.out' }, 1.05)
      .fromTo(joined, { y: 24, opacity: 0, filter: 'blur(8px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', clearProps: 'all' }, 1.1)
      .set(wave, { clipPath: 'circle(0px at 50% 50%)' });
  });

  // Выйти из пульса: спокойно, без волны — точка гаснет, вопрос и кнопка возвращаются
  leave?.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    opts.onLeave();
    setVolunteers(48000);

    const back = () => {
      joined.hidden = true;
      ask.hidden = false;
      btn.hidden = false;
    };

    if (opts.reduced) {
      back();
      busy = false;
      btn.focus();
      return;
    }

    gsap.timeline({ onComplete: () => { busy = false; btn.focus({ preventScroll: true }); } })
      .to(joined, { y: -12, opacity: 0, filter: 'blur(6px)', duration: 0.45, ease: 'quart.in' })
      .call(back)
      .set(joined, { clearProps: 'all' })
      .fromTo(ask, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', clearProps: 'all' })
      .fromTo(btn, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'expo.out', clearProps: 'scale,opacity' }, '<0.1');
  });
}
