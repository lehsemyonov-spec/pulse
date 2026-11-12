// Собирает docs/brief.html из BRIEF.md и таблицы этапов docs/agent/stages.md.
// Запуск: npm run brief. Страница публикуется как артефакт в чате.
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const brief = readFileSync('BRIEF.md', 'utf8');
const stagesMd = readFileSync('docs/agent/stages.md', 'utf8');

const stages = stagesMd
  .split('\n')
  .filter((l) => /^\|\s*\d+\s*\|/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
  .map(([n, title, status]) => ({ n, title, status }));

const state = (s) => (s.startsWith('готов') && !s.includes('ждёт') ? 'done' : s.startsWith('готов') || s.includes('ждёт') ? 'review' : s.includes('работе') ? 'active' : 'todo');
const label = { done: 'готов', review: 'ждёт проверки', active: 'в работе', todo: 'впереди' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/«/g, '«');

const stageList = stages
  .map(({ n, title, status }) => {
    const st = state(status);
    return `<li class="stage stage--${st}"><span class="stage__n">${n.padStart(2, '0')}</span><span class="stage__t">${inline(title)}</span><span class="stage__s"><i></i>${label[st]}</span></li>`;
  })
  .join('\n');

// Таблицы — в контейнер с горизонтальной прокруткой
let body = marked.parse(brief.replace(/^# .*\n/, ''), { gfm: true });
body = body.replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, '</table></div>');
body = body.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');

const updated = new Date().toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

const html = `<title>Пульс · ТЗ</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,400&family=JetBrains+Mono:wght@400&family=Manrope:wght@300;400;500&display=swap">
<style>
/* Тёмная сцена «Пульса», один коралловый акцент. Колонка текста ~68 знаков, таблицы шире. */
:root {
  --bg: #0b0a0d; --surface: rgb(22 20 26 / .6); --line: #24212a;
  --coral: #b8f26a; --peach: #ffb199; --cream: #f4efea; --muted: #bdb7c0;
  --sans: 'Manrope', system-ui, sans-serif; --serif: 'Cormorant Garamond', Georgia, serif; --mono: 'JetBrains Mono', ui-monospace, monospace;
  color-scheme: dark;
}
html { background: var(--bg); }
body { background: var(--bg); color: var(--cream); font: 400 16px/1.6 var(--sans); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 96px; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: 60vh; pointer-events: none; z-index: 0;
  background: radial-gradient(60% 70% at 50% -10%, rgb(255 177 153 / .10), transparent 70%); }
.wrap { position: relative; z-index: 1; max-width: 68ch; margin: 0 auto; }
.wide { max-width: 1040px; margin: 0 auto; position: relative; z-index: 1; }
header { padding-block: 56px 32px; display: grid; gap: 20px; }
.logo { display: flex; align-items: center; gap: 10px; font: 500 18px var(--sans); letter-spacing: -.02em; }
.mark { position: relative; width: 22px; height: 22px; display: grid; place-items: center; }
.mark b { width: 7px; height: 7px; border-radius: 50%; background: var(--coral); }
.mark i { position: absolute; inset: 0; border: 1.5px solid var(--coral); border-radius: 50%; opacity: 0; animation: ring 833ms cubic-bezier(.16,1,.3,1) infinite; }
.mark i + i { animation-delay: 280ms; }
@keyframes ring { 0% { transform: scale(.3); opacity: .9 } 100% { transform: scale(1.1); opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .mark i { animation: none; opacity: .4 } }
h1 { margin: 0; font: 300 clamp(40px, 8vw, 76px)/1 var(--sans); letter-spacing: -.02em; text-wrap: balance; }
h1 em, h2 em, h3 em, p em, li em, td em { font-family: var(--serif); font-style: italic; font-weight: 400; letter-spacing: 0; }
h1 em { color: var(--cream); }
.kicker { font: 400 12px var(--mono); color: var(--muted); letter-spacing: .04em; }
.kicker b { color: var(--coral); font-weight: 400; }
.stages { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.stage { display: grid; grid-template-columns: 36px minmax(0,1fr) auto; gap: 14px; align-items: baseline; padding: 14px 18px; background: var(--bg); }
.stage__n { font: 400 12px var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.stage__t { min-width: 0; }
.stage__s { font: 400 12px var(--mono); color: var(--muted); white-space: nowrap; display: inline-flex; gap: 8px; align-items: center; }
.stage__s i { width: 7px; height: 7px; border-radius: 50%; border: 1px solid var(--muted); }
.stage--done .stage__s i { background: var(--cream); border-color: var(--cream); }
.stage--review .stage__s, .stage--active .stage__s { color: var(--coral); }
.stage--review .stage__s i, .stage--active .stage__s i { background: var(--coral); border-color: var(--coral); box-shadow: 0 0 10px var(--coral); }
.stage--todo .stage__t { color: var(--muted); }
@media (max-width: 520px) { .stage { grid-template-columns: 28px minmax(0,1fr); } .stage__s { grid-column: 2; } }
main h2 { font: 300 clamp(28px, 4.5vw, 40px)/1.1 var(--sans); letter-spacing: -.02em; margin: 72px 0 16px; padding-top: 24px; border-top: 1px solid var(--line); text-wrap: balance; }
main h3 { font: 500 18px/1.3 var(--sans); margin: 36px 0 8px; }
main p, main li { color: #d9d3cd; }
main strong { color: var(--cream); font-weight: 500; }
main ul, main ol { padding-left: 1.2em; display: grid; gap: 6px; }
main a { color: var(--peach); text-underline-offset: 3px; }
code { font: 400 .86em var(--mono); color: var(--peach); background: var(--surface); padding: .1em .35em; border-radius: 4px; }
pre { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; overflow-x: auto; }
pre code { background: none; padding: 0; color: var(--cream); font-size: 13px; line-height: 1.6; }
.table { overflow-x: auto; margin: 16px 0; border: 1px solid var(--line); border-radius: 12px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; min-width: 560px; }
th { text-align: left; font: 400 11px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
th, td { padding: 10px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
td code { white-space: nowrap; }
input[type=checkbox] { accent-color: var(--coral); margin-right: 6px; }
footer { margin-top: 64px; font: 400 12px var(--mono); color: var(--muted); }
</style>

<div class="wrap">
  <header>
    <div class="logo"><span class="mark"><i></i><i></i><b></b></span>пульс</div>
    <h1>Помощь ближе, <em>чем кажется.</em></h1>
    <div class="kicker"><b>●</b> ТЗ концепт-сайта для портфолио · обновлено ${updated}</div>
  </header>
  <section aria-label="Этапы работы">
    <div class="kicker">ЭТАПЫ · одна итерация = один этап</div>
    <ol class="stages">${stageList}</ol>
  </section>
  <main>${body}</main>
  <footer>концепт-проект, истории и цифры вымышлены</footer>
</div>
`;
writeFileSync('docs/brief.html', html);
console.log('docs/brief.html', html.length, 'bytes,', stages.length, 'stages');
