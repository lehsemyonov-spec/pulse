// Проверка: на сайте нет тёмного или тусклого текста — в том числе внутри обёртки окна артефакта.
// Запуск при работающем dev-сервере: npm run check:text
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:5173/';
  const b = await chromium.launch();
  for (const scheme of ['dark', 'light']) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    // Оборачиваем страницу в шаблон окна артефакта (снят с опубликованной версии)
    const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n';
    await p.route(u => new URL(u).pathname === '/', async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: SKELETON + (await res.text()) + '\n</body></html>', headers: { ...res.headers(), 'content-type': 'text/html' } });
    });
    await p.goto(url); await p.waitForTimeout(2500);
    // докрутить до конца, чтобы сработали все появления
    for (let y = 0; y < 12000; y += 400) { await p.evaluate(y => window.__pulse ? window.__pulse.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y), y); await p.waitForTimeout(120); }
    await p.waitForTimeout(2500);
    const bad = await p.evaluate(() => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return [0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]), m[3] ?? 1]; };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const t = walker.currentNode; if (!t.textContent.trim()) continue;
        const el = t.parentElement; const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
        const [L, a] = lum(cs.color);
        const eff = L * op * a; // яркость с учётом прозрачности поверх почти чёрного фона
        if (L < 0.4 || (eff < 0.25 && op > 0.05)) out.push({ text: t.textContent.trim().slice(0, 40), tag: el.tagName + '.' + el.className, color: cs.color, opacity: +op.toFixed(2) });
      }
      return out;
    });
    console.log('== color-scheme:', scheme, '— тёмных/тусклых текстов:', bad.length);
    const seen = new Set();
    for (const x of bad) { const k = x.tag + x.color + x.opacity; if (seen.has(k)) continue; seen.add(k); console.log(JSON.stringify(x)); }
    await p.close();
  }
  await b.close();
})();
