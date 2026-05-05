/**
 * Печать ценников.
 *
 * Получает готовый HTML (макет всех листов) от рендерера, открывает скрытое окно,
 * грузит туда HTML, после ready-to-show вызывает webContents.print().
 *
 * silent=false — показать системный диалог выбора принтера. Если в настройках
 * указан конкретный deviceName, передаём его и можно делать silent=true.
 */
import { app, BrowserWindow, ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";

interface PrintOpts {
  /** Показать системный диалог выбора принтера. По умолчанию true. */
  showDialog?: boolean;
  /** Имя принтера (если уже выбрано). */
  deviceName?: string;
  /** Альтернативно — сохранить как PDF. */
  saveAsPdfPath?: string;
}

async function loadHidden(html: string): Promise<BrowserWindow> {
  const w = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  await w.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(html),
  );
  // Дождаться, чтобы шрифты и canvas (QR) точно отрисовались
  await new Promise((r) => setTimeout(r, 200));
  return w;
}

export function registerPrintIpc() {
  ipcMain.handle(
    "print:tags",
    async (_e, html: string, opts: PrintOpts = {}) => {
      const w = await loadHidden(html);
      try {
        const printOpts: Electron.WebContentsPrintOptions = {
          silent: opts.showDialog === false,
          printBackground: true,
          deviceName: opts.deviceName,
          margins: { marginType: "none" },
          pageSize: "A4",
        };
        const result: { success: boolean; failureReason?: string } = await new Promise(
          (resolve) => {
            w.webContents.print(printOpts, (success, failureReason) => {
              resolve({ success, failureReason });
            });
          },
        );
        return result;
      } finally {
        w.destroy();
      }
    },
  );

  ipcMain.handle(
    "print:savePdf",
    async (_e, html: string, suggestedName: string) => {
      const { dialog } = await import("electron");
      const focused = BrowserWindow.getFocusedWindow();
      if (!focused) return null;
      const res = await dialog.showSaveDialog(focused, {
        title: "Сохранить ценники как PDF",
        defaultPath: suggestedName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (res.canceled || !res.filePath) return null;
      const w = await loadHidden(html);
      try {
        const buf = await w.webContents.printToPDF({
          pageSize: "A4",
          printBackground: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        fs.writeFileSync(res.filePath, buf);
        return res.filePath;
      } finally {
        w.destroy();
      }
    },
  );

  ipcMain.handle("print:listPrinters", async () => {
    const focused = BrowserWindow.getFocusedWindow();
    if (!focused) return [];
    try {
      const list = await focused.webContents.getPrintersAsync();
      return list.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: p.isDefault,
      }));
    } catch {
      return [];
    }
  });
}

/** Логирование — оставлено как утилита, подавим линтер. */
export function _logPath() {
  return path.join(app.getPath("userData"), "print.log");
}
