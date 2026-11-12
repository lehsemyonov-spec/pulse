import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Навигация по блокам: подсветка текущего блока при прокрутке и меню по кнопке на узких экранах. */
export function initNav(): void {
  const header = document.querySelector<HTMLElement>('.header');
  const btn = document.querySelector<HTMLButtonElement>('.header__menu');
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav]')];

  for (const a of links) {
    const section = document.getElementById(a.dataset.nav!);
    if (!section) continue;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  }

  const close = () => {
    header?.classList.remove('is-open');
    btn?.setAttribute('aria-expanded', 'false');
    btn?.setAttribute('aria-label', 'Открыть меню');
  };
  btn?.addEventListener('click', () => {
    const open = !header?.classList.contains('is-open');
    header?.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  });
  links.forEach((a) => a.addEventListener('click', close));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && close());
}
