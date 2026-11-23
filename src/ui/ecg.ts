/**
 * Линия кардиограммы для прелоадера и индикатора прокрутки.
 * Один удар: ровная линия → зубец P → комплекс QRS (высокий пик R) → зубец T → ровная линия.
 */

/** Горизонтальная ЭКГ с одним ударом; пик R — в точке peakX. Возвращает d и координаты пика. */
export function ecgBeat(width: number, height: number, peakX = width / 2): { d: string; peak: [number, number] } {
  const mid = height / 2;
  const a = height * 0.45; // амплитуда пика
  const x = peakX;
  const d = [
    `M0 ${mid}`,
    `L${x - 70} ${mid}`,
    `Q${x - 58} ${mid - a * 0.18} ${x - 46} ${mid}`, // P
    `L${x - 22} ${mid}`,
    `L${x - 14} ${mid + a * 0.16}`, // Q
    `L${x} ${mid - a}`, // R
    `L${x + 10} ${mid + a * 0.7}`, // S
    `L${x + 20} ${mid}`,
    `L${x + 52} ${mid}`,
    `Q${x + 74} ${mid - a * 0.3} ${x + 96} ${mid}`, // T
    `L${width} ${mid}`,
  ].join(' ');
  return { d, peak: [x, mid - a] };
}

/** Вертикальная ЭКГ для индикатора прокрутки: beats ударов на высоте height, отклонение по x. */
export function ecgVertical(width: number, height: number, beats: number): string {
  const mid = width / 2;
  const a = width * 0.42;
  const step = height / beats;
  const parts = [`M${mid} 0`];
  for (let i = 0; i < beats; i++) {
    const y = i * step + step * 0.5;
    parts.push(
      `L${mid} ${y - 16}`,
      `L${mid - a * 0.18} ${y - 11}`,
      `L${mid + a} ${y - 4}`,
      `L${mid - a * 0.7} ${y + 4}`,
      `L${mid} ${y + 10}`,
    );
  }
  parts.push(`L${mid} ${height}`);
  return parts.join(' ');
}
