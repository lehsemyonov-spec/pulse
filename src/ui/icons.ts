import { createIcons, Car, PawPrint, Ear, Languages, Dumbbell, Wrench } from 'lucide';

/** Иконки Lucide (MIT) для чипов навыков, тонкий штрих 1,5 px. */
export function initIcons(): void {
  createIcons({
    icons: { Car, PawPrint, Ear, Languages, Dumbbell, Wrench },
    attrs: { 'stroke-width': '1.5', 'aria-hidden': 'true' },
  });
}
