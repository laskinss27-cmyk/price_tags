/**
 * Настройки внешнего вида ценника. Лежат в userData/settings.json.
 */
import { app, ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";

const SETTINGS_FILE = () => path.join(app.getPath("userData"), "settings.json");

export interface TagSettings {
  company_name: string;
  price_field: "price_sale" | "price_goodsale";
  article_field: string;
  show_article: boolean;
  show_model: boolean;
  qr_size_mm: number;
  name_size_pt: number;
  tag_size: "60x40" | "90x65";
}

export const DEFAULT_SETTINGS: TagSettings = {
  company_name: "Умный Дом",
  price_field: "price_sale",
  article_field: "id",
  show_article: true,
  show_model: true,
  qr_size_mm: 12,
  name_size_pt: 8,
  tag_size: "60x40",
};

function load(): TagSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE(), "utf8");
    const obj = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(obj || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function save(s: TagSettings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(s, null, 2), "utf8");
}

export function getSettings(): TagSettings {
  return load();
}

export function registerSettingsIpc() {
  ipcMain.handle("settings:get", () => load());
  ipcMain.handle("settings:set", (_e, s: Partial<TagSettings>) => {
    const next: TagSettings = { ...load(), ...s };
    save(next);
    return next;
  });
}
