import { createIcons, Car, PawPrint, Ear, Languages, Dumbbell, Wrench, MessageCircle, Radio, Handshake, Menu, Volume2, VolumeX } from 'lucide';

/** Иконки Lucide (MIT): чипы навыков, шаги, меню. Тонкий штрих 1,5 px. */
export function initIcons(): void {
  createIcons({
    icons: { Car, PawPrint, Ear, Languages, Dumbbell, Wrench, MessageCircle, Radio, Handshake, Menu, Volume2, VolumeX },
    attrs: { 'stroke-width': '1.5', 'aria-hidden': 'true' },
  });
}
