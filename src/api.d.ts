import type { Category, Client, ClientsOverlay, Good, PriceMap, PrinterInfo, TagSettings } from "./types";

declare global {
  interface Window {
    api: {
      openExternal: (url: string) => Promise<void>;

      login: (username: string, password: string) => Promise<{ ok: boolean; message: string }>;
      logout: () => Promise<void>;
      checkAuth: () => Promise<boolean>;

      getCatalog: () => Promise<{ savedAt: string | null; goods: Good[]; categories: Category[] }>;
      refreshCatalog: () => Promise<{ savedAt: string | null; goods: Good[]; categories: Category[] }>;
      onCatalogProgress: (cb: (loaded: number) => void) => () => void;

      getClients: () => Promise<{ savedAt: string | null; clients: Client[]; overlay: ClientsOverlay }>;
      refreshClients: () => Promise<{ savedAt: string | null; clients: Client[]; overlay: ClientsOverlay }>;
      onClientsProgress: (cb: (loaded: number) => void) => () => void;
      clientDeleteLocal:  (id: string) => Promise<ClientsOverlay>;
      clientRestoreLocal: (id: string) => Promise<ClientsOverlay>;
      clientEditLocal:    (id: string, patch: Record<string, any>) => Promise<ClientsOverlay>;
      clientResetLocal:   (id: string) => Promise<ClientsOverlay>;
      clientsClearOverlay: () => Promise<ClientsOverlay>;

      getPrices: () => Promise<PriceMap>;
      setPrice: (id: string, price: number | null) => Promise<PriceMap>;

      getSettings: () => Promise<TagSettings>;
      setSettings: (s: Partial<TagSettings>) => Promise<TagSettings>;

      printTags: (
        html: string,
        opts?: { showDialog?: boolean; deviceName?: string },
      ) => Promise<{ success: boolean; failureReason?: string }>;
      savePdf: (html: string, suggestedName: string) => Promise<string | null>;
      listPrinters: () => Promise<PrinterInfo[]>;
    };
  }
}

export {};
