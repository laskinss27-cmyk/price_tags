# Price Tags (Ценники)

Приложение для печати ценников из базы dom-automation.ru.

## Стек

- Electron 28 + React 18 + Vite 5 + TypeScript
- Версия: 2.0.0

## Структура

```
src/
  App.tsx                    — корневой компонент, авторизация
  types.ts                   — TagSize, TagSettings, Good, Price и др.
  tagsHtml.ts                — генерация HTML ценников (sync + async версии)
  utils.ts                   — утилиты
  components/
    Login.tsx                — форма входа (API dom-automation.ru)
    MainView.tsx             — основной интерфейс: дерево + таблица + панель выбора
    CategoryTree.tsx         — дерево категорий товаров
    GoodsTable.tsx           — таблица товаров с поиском
    SelectionPanel.tsx       — правая панель выбранных товаров для печати
    SettingsDialog.tsx       — настройки: размер ценника, шрифт, предпросмотр A4
    TagPreview.tsx           — миниатюра листа A4 с ценниками (iframe + ResizeObserver)
electron/
  main.ts, preload.ts       — Electron main process
  settings.ts               — хранение настроек (tag_size, font и др.)
```

## Размеры ценников

- **60x40 мм**: 3 колонки × 6 рядов = 18 на лист A4
- **90x65 мм**: 2 колонки × 4 ряда = 8 на лист A4

Настройка `tag_size` в `TagSettings`: `"60x40" | "90x65"`.

## Ключевые функции

- `buildTagsHtmlSync()` — синхронная генерация HTML (для предпросмотра)
- `buildTagsHtml()` — асинхронная (с QR-кодом, для печати)
- `makeQrDataUrl()` — QR-код через canvas
- `TagPreview` — ResizeObserver для автомасштабирования A4-миниатюры в iframe

## Команды

```bash
npm run dev
npm run build
npm run dist         # electron-builder, output: release2/ (из-за блокировки release/)
```

## Важно

- Максимум шрифта цены: 18pt
- Окно настроек resizable (`CSS resize: both`)
- API: dom-automation.ru (авторизация по логину/паролю)
- GitHub: `laskinss27-cmyk/price_tags`
- Output dir: `release2` (папка `release/` бывает заблокирована после сборки)
