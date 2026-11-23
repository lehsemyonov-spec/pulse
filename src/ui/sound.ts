import { beatPeriod } from '../core/beat';
import { config } from '../config';

/**
 * Кнопка звука: тихое сердцебиение, по умолчанию выключено.
 * Звук синтезируется Web Audio (без файлов и лицензий) и бьётся по тем же часам,
 * что частицы: «ту» и «дум» с той же паузой.
 */
export function initSound(getStartedAt: () => number): void {
  const btn = document.querySelector<HTMLButtonElement>('.sound');
  if (!btn) return;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer = 0;
  let scheduledUntil = 0; // время (сек, по часам сайта), до которого удары уже поставлены

  // Один удар: низкий тон с падением высоты + мягкий щелчок, всё через фильтр
  const thump = (at: number, strength: number) => {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(62, at);
    osc.frequency.exponentialRampToValueAtTime(38, at + 0.14);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(strength, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + 0.25);
  };

  // Планировщик: раз в 100 мс ставит удары на ближайшие 0,4 с вперёд, точно по часам частиц
  const schedule = () => {
    if (!ctx) return;
    const period = beatPeriod();
    const siteNow = (performance.now() - getStartedAt()) / 1000; // те же часы, что uTime
    const audioNow = ctx.currentTime;
    const horizon = siteNow + 0.4;
    let k = Math.max(Math.floor(scheduledUntil / period), Math.floor(siteNow / period));
    for (; k * period < horizon; k++) {
      const t = k * period;
      if (t < scheduledUntil || t < siteNow - 0.01) continue;
      thump(audioNow + (t - siteNow), 0.9);                    // «ту»
      thump(audioNow + (t + config.beat.gap - siteNow), 0.55); // «дум»
    }
    scheduledUntil = horizon;
  };

  const setOn = async (on: boolean) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Выключить звук сердцебиения' : 'Включить звук сердцебиения');
    btn.classList.toggle('is-on', on);
    if (on) {
      if (!ctx) {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = 0.35; // тихо
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 180;
        master.connect(lp).connect(ctx.destination);
      }
      await ctx.resume();
      scheduledUntil = 0;
      schedule();
      timer = window.setInterval(schedule, 100);
    } else {
      clearInterval(timer);
      await ctx?.suspend();
    }
  };

  btn.addEventListener('click', () => void setOn(btn.getAttribute('aria-pressed') !== 'true'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && btn.getAttribute('aria-pressed') === 'true') void setOn(false);
  });
}
