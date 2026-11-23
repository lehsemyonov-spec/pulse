# Пульс

Концепт-сайт сервиса взаимопомощи: облако частиц, которое при скролле перестраивается из формы в форму. ТЗ: [BRIEF.md](BRIEF.md).

```bash
npm install
npm run dev      # http://localhost:5173, панель параметров: /?debug
npm run build
```

Стек: Vite + TypeScript, three.js, GSAP, Lenis. Без фреймворка.

## Деплой

**GitHub Pages** (подготовлено: `.github/workflows/deploy.yml`):
1. Settings → Pages → Source: **GitHub Actions**.
2. Влить рабочую ветку в `main` — сайт соберётся и опубликуется сам (или Actions → Deploy to GitHub Pages → Run workflow).
3. Адрес появится в Settings → Pages. Его стоит вписать в `og:image` / `og:url` в `index.html` (абсолютной ссылкой).

**Vercel**: New Project → импорт репозитория → Framework: Vite (определится сам) → Deploy.

Проверки перед публикацией: `npm run build`, `npm run check:text` (при запущенном `npm run dev`).
