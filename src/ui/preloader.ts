import { gsap } from 'gsap';
import { ecgBeat } from './ecg';

/**
 * Экран 0. Линия кардиограммы рисуется слева направо, счётчик идёт от 0 до 100 %.
 * Когда всё загружено и счётчик дошёл до 100, линия на пике сжимается в точку,
 * точка вспыхивает — и прелоадер исчезает, а частицы разлетаются из неё в сердце hero.
 */
export function initPreloader(reduced: boolean): {
  /** Дождаться загрузки (ready) и проиграть финал. onBurst получает точку пика в NDC. */
  finish: (ready: Promise<unknown>, onBurst: (ndcX: number, ndcY: number) => void) => Promise<void>;
} {
  const root = document.getElementById('preloader');
  if (!root) return { finish: async (ready, onBurst) => { await ready; onBurst(0, 0); } };

  const W = 640, H = 140;
  const { d, peak } = ecgBeat(W, H, W / 2);
  root.innerHTML = `
    <div class="preloader__inner">
      <svg class="preloader__ecg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path class="preloader__line" d="${d}" />
        <circle class="preloader__dot" cx="${peak[0]}" cy="${peak[1]}" r="5" />
      </svg>
      <p class="mono preloader__label">Синхронизация пульса — <span class="preloader__pct">0</span>%</p>
    </div>`;
  root.hidden = false;
  document.documentElement.classList.add('is-loading');

  const line = root.querySelector<SVGPathElement>('.preloader__line')!;
  const dot = root.querySelector<SVGCircleElement>('.preloader__dot')!;
  const svg = root.querySelector<SVGSVGElement>('.preloader__ecg')!;
  const pct = root.querySelector<HTMLElement>('.preloader__pct')!;
  const len = line.getTotalLength();
  gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
  gsap.set(dot, { scale: 0, transformOrigin: '50% 50%' });

  // Счётчик и линия идут вместе; до 92 % — по времени, остаток — когда загрузка готова
  const counter = { v: 0 };
  const draw = () => {
    pct.textContent = String(Math.round(counter.v));
    line.style.strokeDashoffset = String(len * (1 - counter.v / 100));
  };
  const intro = gsap.to(counter, { v: 92, duration: reduced ? 0.2 : 1.8, ease: 'power2.inOut', onUpdate: draw });

  return {
    finish: async (ready, onBurst) => {
      await Promise.all([ready, intro.then()]);
      await gsap.to(counter, { v: 100, duration: reduced ? 0.1 : 0.45, ease: 'quart.out', onUpdate: draw }).then();

      // где на экране пик — оттуда разлетятся частицы
      const box = svg.getBoundingClientRect();
      const px = box.left + (peak[0] / W) * box.width;
      const py = box.top + (peak[1] / H) * box.height;
      const gl = document.getElementById('gl');
      const ndcX = (px / (gl?.clientWidth || innerWidth)) * 2 - 1;
      const ndcY = 1 - (py / (gl?.clientHeight || innerHeight)) * 2;

      if (reduced) {
        onBurst(ndcX, ndcY);
        root.hidden = true;
        document.documentElement.classList.remove('is-loading');
        return;
      }

      const tl = gsap.timeline();
      // линия сжимается в точку на пике
      tl.to(svg, { scaleX: 0.002, scaleY: 0.01, transformOrigin: `${(peak[0] / W) * 100}% ${(peak[1] / H) * 100}%`, duration: 0.55, ease: 'expo.in' })
        .to(root.querySelector('.preloader__label'), { opacity: 0, y: 8, duration: 0.3, ease: 'quart.in' }, 0)
        .set(svg, { scaleX: 1, scaleY: 1 })
        .set(line, { opacity: 0 })
        // точка вспыхивает
        .to(dot, { scale: 1, duration: 0.18, ease: 'quart.out' })
        .to(dot, { scale: 4.5, opacity: 0, duration: 0.45, ease: 'expo.out' })
        // и взрывается в облако: прелоадер растворяется, частицы летят
        .call(() => onBurst(ndcX, ndcY), [], '<')
        .to(root, { opacity: 0, duration: 0.7, ease: 'quart.out' }, '<0.05')
        .call(() => {
          root.hidden = true;
          document.documentElement.classList.remove('is-loading');
        });
      await tl.then();
    },
  };
}
