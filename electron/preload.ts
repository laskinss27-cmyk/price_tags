import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  openExternal: (url: string) => ipcRenderer.invoke("app:openExternal", url),

  login: (username: string, password: string) =>
    ipcRenderer.invoke("api:login", username, password),
  logout: () => ipcRenderer.invoke("api:logout"),
  checkAuth: () => ipcRenderer.invoke("api:checkAuth"),

  // catalog cache
  getCatalog: () => ipcRenderer.invoke("catalog:get"),
  refreshCatalog: () => ipcRenderer.invoke("catalog:refresh"),
  onCatalogProgress: (cb: (loaded: number) => void) => {
    const h = (_e: unknown, p: { loaded: number }) => cb(p.loaded);
    ipcRenderer.on("catalog:refreshProgress", h);
    return () => ipcRenderer.removeListener("catalog:refreshProgress", h);
  },

  // clients cache
  getClients: () => ipcRenderer.invoke("clients:get"),
  refreshClients: () => ipcRenderer.invoke("clients:refresh"),
  onClientsProgress: (cb: (loaded: number) => void) => {
    const h = (_e: unknown, p: { loaded: number }) => cb(p.loaded);
    ipcRenderer.on("clients:refreshProgress", h);
    return () => ipcRenderer.removeListener("clients:refreshProgress", h);
  },
  // local overlay edits
  clientDeleteLocal:  (id: string) => ipcRenderer.invoke("clients:deleteLocal",  id),
  clientRestoreLocal: (id: string) => ipcRenderer.invoke("clients:restoreLocal", id),
  clientEditLocal:    (id: string, patch: Record<string, any>) => ipcRenderer.invoke("clients:editLocal", id, patch),
  clientResetLocal:   (id: string) => ipcRenderer.invoke("clients:resetLocal",   id),
  clientsClearOverlay: () => ipcRenderer.invoke("clients:clearOverlay"),

  getPrices: () => ipcRenderer.invoke("prices:get"),
  setPrice: (id: string, price: number | null) =>
    ipcRenderer.invoke("prices:set", id, price),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (s: unknown) => ipcRenderer.invoke("settings:set", s),

  printTags: (
    html: string,
    opts?: { showDialog?: boolean; deviceName?: string },
  ) => ipcRenderer.invoke("print:tags", html, opts),
  savePdf: (html: string, suggestedName: string) =>
    ipcRenderer.invoke("print:savePdf", html, suggestedName),
  listPrinters: () => ipcRenderer.invoke("print:listPrinters"),
});
