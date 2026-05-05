/**
 * Утилиты форматирования и нормализации.
 */
const NBSP = " "; // narrow no-break space

export function fmtPrice(value: unknown): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }).replace(/ /g, NBSP);
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;
  const s = String(value).replace(/[\s  ]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const STUB_PRICES = new Set([100000, 1000, 999, 99999, 12345]);

/** Помечаем подозрительные цены-заглушки. */
export function isStubPrice(value: unknown): boolean {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return true;
  return STUB_PRICES.has(n);
}
