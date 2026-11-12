import { config } from '../config';

/**
 * Единые часы сердцебиения «ту-дум». Та же формула продублирована
 * в particles.vert — частицы, точка статуса и CTA бьются синхронно.
 */
const ATTACK = 0.07; // с до пика каждого удара

function hit(x: number): number {
  if (x < 0) return 0;
  const k = x / ATTACK;
  return k * Math.exp(1 - k); // 0 → 1 (пик) → затухание
}

export function beatPeriod(): number {
  return 60 / config.beat.bpm;
}

/** Огибающая удара 0–1 в момент t (секунды). */
export function beatAt(t: number): number {
  const p = ((t % beatPeriod()) + beatPeriod()) % beatPeriod();
  return Math.max(hit(p), config.beat.second * hit(p - config.beat.gap));
}
