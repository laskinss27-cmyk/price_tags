/**
 * HTTP-клиент к admin.dom-automation.ru.
 * Логинится формой, дальше использует cookies из persist:price_tags-api.
 *
 * Запускается в main-процессе, чтобы обойти CORS и хранить cookies.
 */
import { net, session } from "electron";

const BASE_URL = "https://admin.dom-automation.ru";

/**
 * Используем дефолтную сессию: net.fetch ходит через неё, cookies хранятся в
 * userData/Cookies автоматически между запусками приложения.
 */

interface AuthResult { ok: boolean; message: string; }

export async function apiLogin(username: string, password: string): Promise<AuthResult> {
  const body = new URLSearchParams({
    authorization_login: username,
    authorization_pass: password,
  }).toString();

  try {
    const resp = await net.fetch(BASE_URL + "/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body,
      credentials: "include",
    });
    const text = await resp.text();
    // Те же эвристики, что в Python: страница без формы логина и достаточно длинная.
    if (resp.ok && !text.includes("authorization_login") && text.length > 8000) {
      return { ok: true, message: "OK" };
    }
    return { ok: false, message: "Неверный логин или пароль" };
  } catch (e: any) {
    if (e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND") {
      return { ok: false, message: "Нет соединения с сервером" };
    }
    return { ok: false, message: e?.message || String(e) };
  }
}

export async function apiLogout(): Promise<void> {
  try {
    await session.defaultSession.clearStorageData({ storages: ["cookies"] });
  } catch {}
}

/** Узнать, авторизованы ли мы — дёргаем главную и смотрим, нет ли формы логина. */
export async function apiCheckAuth(): Promise<boolean> {
  try {
    const resp = await net.fetch(BASE_URL + "/", {
      method: "GET",
      credentials: "include",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    const text = await resp.text();
    return resp.ok && !text.includes("authorization_login") && text.length > 8000;
  } catch {
    return false;
  }
}

export interface ApiCategory { id: string; name: string; parent: string; }

export async function apiGetCategories(): Promise<ApiCategory[]> {
  try {
    const url =
      BASE_URL +
      "/ajax/get.php?module=mod_categories&fget=tree&getFormat=json";
    const resp = await net.fetch(url, {
      method: "GET",
      credentials: "include",
    });
    const raw = await resp.json();
    if (!Array.isArray(raw)) return [];
    const out: ApiCategory[] = [];
    for (const item of raw) {
      if (item && typeof item === "object") {
        const meta = (item as any).metadata;
        if (meta && "id" in meta) {
          out.push({
            id: String(meta.id),
            name: String(meta.name ?? meta.id),
            parent: String(meta.parent ?? "0"),
          });
        } else if ("id" in (item as any)) {
          const it = item as any;
          out.push({
            id: String(it.id),
            name: String(it.name ?? it.id),
            parent: String(it.parent ?? "0"),
          });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

export type ApiGood = Record<string, any> & {
  id: string | number;
  name?: string;
  model?: string;
  manufacturer_name?: string;
  price_sale?: string | number;
  price_goodsale?: string | number;
  archived?: string | number;
  categories?: (string | number)[];
};

/**
 * Полная выгрузка каталога: пагинация по `rows` штук, пока сервер не вернёт
 * меньше, чем запросили (= последняя страница). С прогрессом.
 *
 * Архивные товары НЕ фильтруем здесь — отдадим как есть, отфильтруем в UI
 * (так пользователь увидит реальное количество).
 */
export async function apiGetGoods(
  onProgress?: (loaded: number) => void,
  rowsPerPage = 1000,
  maxPages = 50,
): Promise<ApiGood[]> {
  const all: ApiGood[] = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const qs = new URLSearchParams({
        module: "mod_goods",
        getFormat: "json",
        page: String(page),
        rows: String(rowsPerPage),
      });
      const body = new URLSearchParams({
        _search: "false",
        sidx: "name",
        sord: "asc",
        page: String(page),
        rows: String(rowsPerPage),
      }).toString();
      const resp = await net.fetch(BASE_URL + "/ajax/get.php?" + qs.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        credentials: "include",
      });
      const data = await resp.json();
      if (!Array.isArray(data) || data.length === 0) break;
      all.push(...(data as ApiGood[]));
      onProgress?.(all.length);
      if (data.length < rowsPerPage) break; // последняя страница
    } catch (e) {
      console.error(`apiGetGoods page=${page} error:`, e);
      break;
    }
  }
  return all;
}
