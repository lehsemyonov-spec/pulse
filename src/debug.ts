import GUI from 'lil-gui';
import { config } from './config';
import type { Scene } from './gl/Scene';

/** Панель подкрутки параметров. Подключается только с ?debug и в основной бандл не попадает. */
export function initDebug(scene: Scene, rebuild: () => void): GUI {
  const gui = new GUI({ title: 'Пульс · debug' });
  gui.add(scene.stats, 'fps').name('fps').listen().disable();

  const p = gui.addFolder('Частицы');
  p.add(config.particles, 'countDesktop', 2000, 40000, 1000).name('кол-во (десктоп)').onFinishChange(rebuild);
  p.add(config.particles, 'countMobile', 2000, 20000, 1000).name('кол-во (телефон)').onFinishChange(rebuild);
  p.add(config.particles, 'size', 0.5, 8, 0.05).name('размер');
  p.add(config.particles, 'brightness', 0.05, 2, 0.01).name('яркость');
  p.add(config.particles, 'coralRatio', 0, 0.5, 0.005).name('доля коралла');
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
  h.add(config.heart, 'source', ['auto', 'mask', 'procedural']).name('источник').onFinishChange(rebuild);
  h.add(config.heart, 'fill', 0.2, 1, 0.01).name('высота на экране').onChange(() => scene.resize());
  h.add(config.heart, 'shell', 0, 1, 0.01).name('доля поверхности').onFinishChange(rebuild);
  h.add(config.heart, 'maskDepth', 0, 1.5, 0.01).name('глубина маски').onFinishChange(rebuild);
  h.add(config.heart, 'swayAmplitude', 0, Math.PI, 0.01).name('покачивание, рад');
  h.add(config.heart, 'swaySpeed', 0, 2, 0.01).name('скорость покачивания');

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

  return gui;
}
