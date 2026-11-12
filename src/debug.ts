import GUI from 'lil-gui';
import { config } from './config';
import type { Scene } from './gl/Scene';
import type { Particles } from './gl/Particles';
import { SHAPE_ORDER } from './gl/shapes';

/** Панель подкрутки параметров. Открывается по ?debug или клавише D, в основной бандл не попадает. */
export function initDebug(scene: Scene, particles: Particles, goTo: (screen: number) => void, count: () => number): GUI {
  const gui = new GUI({ title: 'Пульс · debug (H — скрыть)' });
  const rebuildAll = () => void particles.buildAll(count());
  const rebuildHeart = () => void particles.rebuild(['heart']);
  gui.add(scene.stats, 'fps').name('fps').listen().disable();
  const st = particles.state;
  gui.add(st, 'p').name('скролл, экраны').listen().disable();
  gui.add(st, 'progress').name('прогресс перехода').listen().disable();

  const jump = gui.addFolder('Перейти к экрану');
  const names = ['1 · сердце', '2 · хаос', '3 · город', '4 · руки', '5 · созвездия', '6 · кольцо'];
  SHAPE_ORDER.forEach((_, i) => jump.add({ go: () => goTo(i) }, 'go').name(names[i]));
  jump.close();

  const mo = gui.addFolder('Морфинг');
  mo.add(config.morph, 'start', 0, 0.9, 0.01).name('начало перелёта');
  mo.add(config.morph, 'end', 0.1, 1, 0.01).name('конец перелёта');
  mo.add(config.morph, 'spread', 0, 4, 0.05).name('растянутость волны');
  mo.add(config.morph, 'swirl', 0, 2, 0.01).name('завихрение');
  mo.add(config.morph, 'swirlScale', 0.05, 3, 0.01).name('масштаб вихрей');
  mo.add(config.scroll, 'lerp', 0.02, 0.3, 0.005).name('плавность скролла');
  mo.add(config.hands, 'gap', 0, 1.5, 0.01).name('руки: разведение');
  mo.add(config.city, 'tilt', 0, 1.5, 0.01).name('город: наклон').onFinishChange(() => void particles.rebuild(['city']));
  mo.add(config.constellations, 'groups', 4, 60, 1).name('созвездия: групп').onFinishChange(() => void particles.rebuild(['constellations']));
  mo.add(config.ring, 'radius', 0.3, 1.5, 0.01).name('кольцо: радиус').onFinishChange(() => void particles.rebuild(['ring']));

  const sh = gui.addFolder('Характер форм');
  for (const name of SHAPE_ORDER) {
    const f = sh.addFolder(name);
    const c = config.shapes[name];
    f.add(c, 'brightness', 0, 2, 0.01).name('яркость');
    f.add(c, 'beat', 0, 1.5, 0.01).name('удар');
    f.add(c, 'noise', 0, 3, 0.01).name('шум');
    f.add(c, 'drift', 0, 2, 0.01).name('дрейф');
    f.close();
  }
  sh.close();

  const p = gui.addFolder('Частицы');
  p.add(config.particles, 'countDesktop', 2000, 40000, 1000).name('кол-во (десктоп)').onFinishChange(rebuildAll);
  p.add(config.particles, 'countMobile', 2000, 20000, 1000).name('кол-во (телефон)').onFinishChange(rebuildAll);
  p.add(config.particles, 'size', 0.5, 8, 0.05).name('размер');
  p.add(config.particles, 'brightness', 0.05, 2, 0.01).name('яркость');
  p.add(config.particles, 'accentRatio', 0, 0.5, 0.005).name('доля акцента');
  p.add(config.particles, 'depthFade', 0, 1, 0.01).name('затухание сзади');

  const n = gui.addFolder('Шум');
  n.add(config.noise, 'strength', 0, 0.4, 0.001).name('сила');
  n.add(config.noise, 'speed', 0, 2, 0.01).name('скорость');
  n.add(config.noise, 'scale', 0.1, 6, 0.05).name('масштаб вихрей');

  const b = gui.addFolder('Сердцебиение');
  b.add(config.beat, 'bpm', 30, 160, 1).name('уд./мин');
  b.add(config.beat, 'scale', 0, 0.2, 0.001).name('скейл удара');
  b.add(config.beat, 'second', 0, 1, 0.01).name('сила «дум»');
  b.add(config.beat, 'gap', 0.1, 0.5, 0.01).name('пауза ту→дум, с');
  b.add(config.beat, 'wave', 0, 0.4, 0.005).name('задержка волны');

  const m = gui.addFolder('Курсор');
  m.add(config.mouse, 'radius', 0.02, 0.8, 0.01).name('радиус');
  m.add(config.mouse, 'strength', 0, 2, 0.01).name('сила');
  m.add(config.mouse, 'ease', 0.01, 1, 0.01).name('инерция');
  m.add(config.mouse, 'tilt', 0, 0.6, 0.01).name('наклон формы');

  const h = gui.addFolder('Сердце');
  h.add(config.heart, 'source', ['auto', 'mask', 'procedural']).name('источник').onFinishChange(rebuildHeart);
  h.add(config.heart, 'fill', 0.2, 1, 0.01).name('высота на экране').onChange(() => scene.resize());
  h.add(config.heart, 'shell', 0, 1, 0.01).name('доля поверхности').onFinishChange(rebuildHeart);
  h.add(config.heart, 'maskDepth', 0, 1.5, 0.01).name('глубина маски').onFinishChange(rebuildHeart);
  h.add(config.heart, 'swayAmplitude', 0, Math.PI, 0.01).name('покачивание, рад');
  h.add(config.heart, 'swaySpeed', 0, 2, 0.01).name('скорость покачивания');

  const fl = gui.addFolder('Касание рук');
  fl.add(config.flash, 'speed', 0.3, 6, 0.05).name('скорость волны');
  fl.add(config.flash, 'push', 0, 0.8, 0.01).name('сдвиг гребнем');
  fl.add(config.flash, 'intensity', 0, 3, 0.01).name('яркость');
  fl.add({ go: () => particles.flash() }, 'go').name('▶ вспышка');
  fl.close();

  const post = gui.addFolder('Свет и плёнка');
  post.add(config.bloom, 'strength', 0, 3, 0.01).name('bloom: сила');
  post.add(config.bloom, 'radius', 0, 1.5, 0.01).name('bloom: радиус');
  post.add(config.bloom, 'threshold', 0, 1, 0.01).name('bloom: порог');
  post.add(config.post, 'grain', 0, 0.15, 0.001).name('зерно');
  post.add(config.post, 'vignette', 0, 1, 0.01).name('виньетка');

  gui.add(
    {
      copy: async () => {
        const json = JSON.stringify(config, null, 2);
        try {
          await navigator.clipboard.writeText(json);
          console.info('[pulse] config скопирован в буфер обмена');
        } catch {
          console.info(json);
        }
      },
    },
    'copy',
  ).name('Скопировать config');

  // H — спрятать/показать панель
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'р') gui.show(gui._hidden);
  });
  return gui;
}
