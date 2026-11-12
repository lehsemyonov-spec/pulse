/**
 * CSS-анимации ритма (точка статуса, кольца логотипа, кнопки) запускаются
 * от того же момента, что и часы WebGL, — тогда «ту-дум» у частиц и у интерфейса совпадает.
 */
export function syncBeat(startedAt: number): void {
  for (const a of document.getAnimations()) {
    const name = (a as CSSAnimation).animationName;
    if (name && name.startsWith('beat-')) a.startTime = startedAt;
  }
}
