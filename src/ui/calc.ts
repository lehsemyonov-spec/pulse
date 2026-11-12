import { gsap } from 'gsap';
import { plural } from './plural';

/**
 * Экран 5: «Сколько времени ты можешь подарить?»
 * Формула из BRIEF: часы × 4 недели ÷ 1,5 часа на просьбу × (1 + 0,1 × число навыков), округление.
 * Пример: 2 часа и 1 навык → 6. Максимум: 10 часов и 6 навыков → 43.
 */
export function peoplePerMonth(hours: number, skills: number): number {
  return Math.round(((hours * 4) / 1.5) * (1 + 0.1 * skills));
}

export function initCalc(onChange: (people: number) => void): void {
  const range = document.querySelector<HTMLInputElement>('#hours');
  const hoursOut = document.querySelector<HTMLOutputElement>('#hours-out');
  const out = document.querySelector<HTMLElement>('#people-out');
  const word = document.querySelector<HTMLElement>('#people-word');
  const chips = [...document.querySelectorAll<HTMLInputElement>('.chips input[type="checkbox"]')];
  if (!range || !hoursOut || !out || !word) return;

  const shown = { n: Number(out.textContent) || 0 };
  const render = () => {
    const hours = Number(range.value);
    const skills = chips.filter((c) => c.checked).length;
    const people = peoplePerMonth(hours, skills);
    hoursOut.textContent = String(hours);
    // заливка дорожки слайдера до текущего значения
    const pct = ((hours - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100;
    range.style.setProperty('--fill', `${pct}%`);
    // число докручивается, слово склоняется по итоговому значению
    gsap.to(shown, {
      n: people,
      duration: 0.6,
      ease: 'quart.out',
      overwrite: true,
      onUpdate: () => (out.textContent = String(Math.round(shown.n))),
    });
    word.textContent = plural(people, ['человек', 'человека', 'человек']);
    onChange(people);
  };

  range.addEventListener('input', render);
  chips.forEach((c) => c.addEventListener('change', render));
  render();
}
