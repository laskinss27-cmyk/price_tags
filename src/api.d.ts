import type { Category, Good, PriceMap, PrinterInfo, TagSettings } from "./types";

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
