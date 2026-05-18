import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "path";
import { apiCheckAuth, apiLogin, apiLogout } from "./api";
import { registerCatalogIpc } from "./catalog";
import { registerClientsIpc } from "./clients";
import { registerPriceIpc } from "./prices";
import { registerSettingsIpc } from "./settings";
import { registerPrintIpc } from "./print";

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0f1115",
    title: "Печать ценников",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("app:openExternal", (_e, url: string) => shell.openExternal(url));

  ipcMain.handle("api:login", (_e, u: string, p: string) => apiLogin(u, p));
  ipcMain.handle("api:logout", () => apiLogout());
  ipcMain.handle("api:checkAuth", () => apiCheckAuth());

  registerCatalogIpc();
  registerClientsIpc();
  registerPriceIpc();
  registerSettingsIpc();
  registerPrintIpc();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
