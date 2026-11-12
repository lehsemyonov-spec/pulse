/** Русское множественное: plural(2, ['человек', 'человека', 'человек']) → «человека». */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** 48000 → «48 000» с неразрывным пробелом. */
export const formatNumber = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ');
