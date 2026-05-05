/**
 * Локальный кэш каталога. Лежит в userData/catalog.json — переживает
 * обновления приложения. Программа стартует мгновенно из кэша, а
 * пользователь сам жмёт «Обновить базу» когда нужно (или при первом запуске).
 *
 * Формат:
 *   { savedAt: "ISO-string", goods: ApiGood[], categories: ApiCategory[] }
 */
import { app, ipcMain, BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";
import { apiGetCategories, apiGetGoods, type ApiCategory, type ApiGood } from "./api";

const CATALOG_FILE = () => path.join(app.getPath("userData"), "catalog.json");

export interface CatalogCache {
  savedAt: string | null;
  goods: ApiGood[];
  categories: ApiCategory[];
}

function load(): CatalogCache {
  try {
    const raw = fs.readFileSync(CATALOG_FILE(), "utf8");
    const obj = JSON.parse(raw);
    if (
      obj && typeof obj === "object" &&
      Array.isArray(obj.goods) && Array.isArray(obj.categories)
    ) {
      return {
        savedAt: typeof obj.savedAt === "string" ? obj.savedAt : null,
        goods: obj.goods,
        categories: obj.categories,
      };
    }
  } catch {}
  return { savedAt: null, goods: [], categories: [] };
}

function save(c: CatalogCache) {
  fs.mkdirSync(path.dirname(CATALOG_FILE()), { recursive: true });
  fs.writeFileSync(CATALOG_FILE(), JSON.stringify(c), "utf8");
}

export function registerCatalogIpc() {
  ipcMain.handle("catalog:get", () => load());

  ipcMain.handle("catalog:refresh", async (e) => {
    const wc = e.sender;
    const send = (loaded: number) => {
      try { wc.send("catalog:refreshProgress", { loaded }); } catch {}
    };

    const [categories, goods] = await Promise.all([
      apiGetCategories(),
      apiGetGoods(send),
    ]);
    const fresh: CatalogCache = {
      savedAt: new Date().toISOString(),
      goods,
      categories,
    };
    save(fresh);
    return fresh;
  });
}

/** Утилита: говорить ли о пустом кэше (например, при первом запуске). */
export function isCatalogEmpty(): boolean {
  const c = load();
  return c.goods.length === 0;
}

// Хелпер на случай, если когда-нибудь захотим стримить прогресс из main:
export function broadcastProgress(loaded: number) {
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send("catalog:refreshProgress", { loaded }); } catch {}
  }
}
