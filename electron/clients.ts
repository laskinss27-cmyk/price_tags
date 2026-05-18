/**
 * Локальный кэш клиентов. Лежит в userData/clients.json — переживает
 * обновления приложения. Программа стартует мгновенно из кэша, а
 * пользователь сам жмёт «Обновить клиентов» когда нужно.
 *
 * Формат: { savedAt: "ISO-string", clients: ApiClient[] }
 */
import { app, ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import { apiGetClients, type ApiClient } from "./api";

const CLIENTS_FILE = () => path.join(app.getPath("userData"), "clients.json");
const OVERLAY_FILE = () => path.join(app.getPath("userData"), "clients-overlay.json");

export interface ClientsCache {
  savedAt: string | null;
  clients: ApiClient[];
}

/**
 * Локальные правки и удаления — живут отдельно от кэша.
 * После refresh с сервера оверлей сохраняется и применяется поверх свежих данных.
 *  - deletedIds: id клиентов, которые скрыты в UI (можно «восстановить»)
 *  - edits: id → partial-объект; накладывается поверх серверных полей
 */
export interface ClientsOverlay {
  deletedIds: string[];
  edits: Record<string, Record<string, any>>;
}

function loadOverlay(): ClientsOverlay {
  try {
    const raw = fs.readFileSync(OVERLAY_FILE(), "utf8");
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      return {
        deletedIds: Array.isArray(obj.deletedIds) ? obj.deletedIds.map(String) : [],
        edits: (obj.edits && typeof obj.edits === "object") ? obj.edits : {},
      };
    }
  } catch {}
  return { deletedIds: [], edits: {} };
}

function saveOverlay(o: ClientsOverlay) {
  fs.mkdirSync(path.dirname(OVERLAY_FILE()), { recursive: true });
  fs.writeFileSync(OVERLAY_FILE(), JSON.stringify(o), "utf8");
}

function load(): ClientsCache {
  try {
    const raw = fs.readFileSync(CLIENTS_FILE(), "utf8");
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && Array.isArray(obj.clients)) {
      return {
        savedAt: typeof obj.savedAt === "string" ? obj.savedAt : null,
        clients: obj.clients,
      };
    }
  } catch {}
  return { savedAt: null, clients: [] };
}

function save(c: ClientsCache) {
  fs.mkdirSync(path.dirname(CLIENTS_FILE()), { recursive: true });
  fs.writeFileSync(CLIENTS_FILE(), JSON.stringify(c), "utf8");
}

export function registerClientsIpc() {
  ipcMain.handle("clients:get", () => ({ ...load(), overlay: loadOverlay() }));

  ipcMain.handle("clients:refresh", async (e) => {
    const wc = e.sender;
    const send = (loaded: number) => {
      try { wc.send("clients:refreshProgress", { loaded }); } catch {}
    };
    const clients = await apiGetClients(send);
    const fresh: ClientsCache = {
      savedAt: new Date().toISOString(),
      clients,
    };
    save(fresh);
    return { ...fresh, overlay: loadOverlay() };
  });

  // Локальное удаление: просто прячем клиента в UI. Сервер не трогаем.
  ipcMain.handle("clients:deleteLocal", (_e, id: string) => {
    const o = loadOverlay();
    if (!o.deletedIds.includes(id)) o.deletedIds.push(id);
    saveOverlay(o);
    return o;
  });

  // Восстановление удалённого.
  ipcMain.handle("clients:restoreLocal", (_e, id: string) => {
    const o = loadOverlay();
    o.deletedIds = o.deletedIds.filter((x) => x !== id);
    saveOverlay(o);
    return o;
  });

  // Правка полей в локальном кэше (поверх серверных значений).
  ipcMain.handle("clients:editLocal", (_e, id: string, patch: Record<string, any>) => {
    const o = loadOverlay();
    const cur = o.edits[id] || {};
    o.edits[id] = { ...cur, ...patch };
    saveOverlay(o);
    return o;
  });

  // Сбросить локальные правки одного клиента (вернуть «как на сервере»).
  ipcMain.handle("clients:resetLocal", (_e, id: string) => {
    const o = loadOverlay();
    delete o.edits[id];
    saveOverlay(o);
    return o;
  });

  // Полный сброс оверлея.
  ipcMain.handle("clients:clearOverlay", () => {
    const o: ClientsOverlay = { deletedIds: [], edits: {} };
    saveOverlay(o);
    return o;
  });
}
