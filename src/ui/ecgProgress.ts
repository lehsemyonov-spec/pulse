import { ecgVertical } from './ecg';

/** Справа — вертикальная линия ЭКГ (удар на каждый экран), прорисовывается по мере прокрутки. */
export function initEcgProgress(screens: number): (progress: number) => void {
  const W = 24, H = 600;
  const el = document.createElement('div');
  el.className = 'ecg-progress';
  el.setAttribute('aria-hidden', 'true');
  const d = ecgVertical(W, H, screens);
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path class="ecg-progress__track" d="${d}" />
      <path class="ecg-progress__line" d="${d}" />
      <circle class="ecg-progress__head" r="3" />
    </svg>`;
  document.body.appendChild(el);
  const line = el.querySelector<SVGPathElement>('.ecg-progress__line')!;
  const head = el.querySelector<SVGCircleElement>('.ecg-progress__head')!;
  const len = line.getTotalLength();
  line.style.strokeDasharray = String(len);

  return (progress: number) => {
    const p = Math.min(1, Math.max(0, progress));
    line.style.strokeDashoffset = String(len * (1 - p));
    const pt = line.getPointAtLength(len * p);
    head.setAttribute('cx', String(pt.x));
    head.setAttribute('cy', String(pt.y));
  };
}
