import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { formatNumber, plural } from './plural';

gsap.registerPlugin(ScrollTrigger);

/** Цифры докручиваются от 0, когда блок появляется на экране (или в момент касания рук). */
export function initCounters(reduced: boolean): { start: () => void } {
  const els = [...document.querySelectorAll<HTMLElement>('[data-count]')];
  let started = false;
  const start = () => {
    if (started || reduced) return;
    started = true;
    els.forEach((el, i) => {
      const target = Number(el.dataset.count);
      const v = { n: 0 };
      gsap.to(v, {
        n: target,
        duration: 2.4,
        delay: i * 0.12,
        ease: 'expo.out',
        onUpdate: () => (el.textContent = formatNumber(v.n)),
      });
    });
  };
  if (!reduced) {
    els.forEach((el) => (el.textContent = '0'));
    const stats = document.querySelector('.stats');
    if (stats) ScrollTrigger.create({ trigger: stats, start: 'top 96%', once: true, onEnter: start });
  }
  return { start };
}

/** «● 1 284 человека помогают прямо сейчас» — число живёт: раз в несколько секунд чуть меняется. */
export function initLiveCounter(reduced: boolean): void {
  const num = document.querySelector<HTMLElement>('[data-live]');
  const word = document.querySelector<HTMLElement>('[data-live-word]');
  if (!num || !word) return;
  let n = 1284;
  const render = () => {
    num.textContent = formatNumber(n);
    word.textContent = plural(n, ['человек', 'человека', 'человек']);
  };
  render();
  if (reduced) return;
  const tick = () => {
    const step = Math.ceil(Math.random() * 3) * (Math.random() < 0.55 ? 1 : -1);
    n = Math.min(1340, Math.max(1230, n + step));
    gsap.fromTo(num, { opacity: 0.35 }, { opacity: 1, duration: 0.6, ease: 'quart.out' });
    render();
    window.setTimeout(tick, 2400 + Math.random() * 2600);
  };
  window.setTimeout(tick, 3000);
}
