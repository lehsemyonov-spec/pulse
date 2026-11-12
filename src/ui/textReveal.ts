import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const EXPO = 'expo.out';
const QUART = 'quart.out';

/**
 * Заголовки появляются по строкам снизу из-под маски; курсивное слово — на 0,15 с позже
 * с лёгким размытием. Блоки [data-fade] выезжают на 24 px из прозрачности.
 * Скрытое начальное состояние ставит JS: без него текст просто виден.
 */
export function initTextReveal(reduced: boolean): { playHero: () => void } {
  let heroTl: gsap.core.Timeline | null = null;

  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    const isHero = el.dataset.reveal === 'load';
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'line',
      autoSplit: true,
      onSplit(self) {
        if (reduced) return;
        const ems = el.querySelectorAll('em');
        const tl = gsap.timeline({ paused: true });
        tl.from(self.lines, { yPercent: 105, duration: 1.4, ease: EXPO, stagger: 0.09 });
        if (ems.length) tl.from(ems, { opacity: 0, filter: 'blur(10px)', duration: 1.2, ease: QUART }, 0.15);
        if (isHero) heroTl = tl;
        else ScrollTrigger.create({ trigger: el, start: 'top 82%', once: true, onEnter: () => tl.play() });
        return tl;
      },
    });
  }

  // Карточки, шаги, цифры: 24 px снизу из прозрачности, группой по родителю
  const fades = [...document.querySelectorAll<HTMLElement>('[data-fade]')];
  const heroFades = fades.filter((el) => el.closest('#hero'));
  if (!reduced) {
    gsap.set(fades, { y: 24, opacity: 0 });
    const groups = new Map<HTMLElement, HTMLElement[]>();
    for (const el of fades) {
      if (heroFades.includes(el)) continue;
      const parent = el.parentElement!;
      groups.set(parent, [...(groups.get(parent) ?? []), el]);
    }
    for (const [parent, els] of groups) {
      ScrollTrigger.create({
        trigger: parent,
        start: 'top 85%',
        once: true,
        onEnter: () => gsap.to(els, { y: 0, opacity: 1, duration: 1.1, ease: QUART, stagger: 0.1 }),
      });
    }
  }

  // Фраза экрана 2: слова зажигаются по очереди по мере скролла
  const phrase = document.querySelector<HTMLElement>('[data-words]');
  if (phrase) {
    const split = SplitText.create(phrase, { type: 'words', wordsClass: 'word' });
    if (reduced) gsap.set(split.words, { opacity: 1 });
    else
      gsap.to(split.words, {
        opacity: 1,
        ease: 'none',
        stagger: 0.5,
        scrollTrigger: { trigger: phrase.closest('section'), start: 'top 40%', end: 'bottom 120%', scrub: 0.6 },
      });
  }

  return {
    playHero: () => {
      if (reduced) return;
      heroTl?.play();
      gsap.to(heroFades, { y: 0, opacity: 1, duration: 1.2, ease: QUART, stagger: 0.12, delay: 0.45 });
    },
  };
}
