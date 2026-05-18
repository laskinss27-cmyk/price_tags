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

export interface ClientsCache {
  savedAt: string | null;
  clients: ApiClient[];
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
  ipcMain.handle("clients:get", () => load());

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
    return fresh;
  });
}
