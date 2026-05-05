/**
 * Сборщик HTML-листа ценников для печати.
 * Поддерживает два формата:
 *   60×40 мм → 3 × 6 = 18 шт/лист
 *   90×65 мм → 2 × 4 =  8 шт/лист
 */
import QRCode from "qrcode";
import type { Good, PriceMap, TagSettings, TagSize } from "./types";
import { fmtPrice, toNumber } from "./utils";

const QR_URL = "https://dom-automation.ru";

interface SizeSpec {
  w: number;
  h: number;
  cols: number;
  rows: number;
  priceFont: number;
  curFont: number;
  artFont: number;
  companyFont: number;
  botH: number;
}

const SIZES: Record<TagSize, SizeSpec> = {
  "60x40": { w: 60, h: 40, cols: 3, rows: 6, priceFont: 22, curFont: 7, artFont: 6, companyFont: 6.5, botH: 4 },
  "90x65": { w: 90, h: 65, cols: 2, rows: 4, priceFont: 32, curFont: 9, artFont: 7.5, companyFont: 8, botH: 5 },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function priceFor(g: Good, prices: PriceMap, settings: TagSettings): string {
  const id = String(g.id);
  if (prices[id] !== undefined) return fmtPrice(prices[id]);
  return fmtPrice(g[settings.price_field]);
}

function articleFor(g: Good, settings: TagSettings): string {
  const v = g[settings.article_field];
  return v == null ? "" : String(v).trim();
}

async function makeQrDataUrl(): Promise<string> {
  return await QRCode.toDataURL(QR_URL, {
    margin: 0,
    width: 256,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function buildTagsHtml(
  goods: Good[],
  prices: PriceMap,
  settings: TagSettings,
): Promise<string> {
  const qrDataUrl = await makeQrDataUrl();
  return buildTagsHtmlSync(goods, prices, settings, qrDataUrl);
}

export function buildTagsHtmlSync(
  goods: Good[],
  prices: PriceMap,
  settings: TagSettings,
  qrDataUrl: string,
): string {
  const sz = SIZES[settings.tag_size] || SIZES["60x40"];
  const PER_PAGE = sz.cols * sz.rows;
  const qrSize = settings.qr_size_mm;
  const nameSize = settings.name_size_pt;
  const modelSize = Math.max(5.5, nameSize - 1.5);
  const isLarge = settings.tag_size === "90x65";

  const pages: Good[][] = [];
  for (let i = 0; i < goods.length; i += PER_PAGE) {
    pages.push(goods.slice(i, i + PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const tagHtml = (g: Good) => {
    const article = settings.show_article ? articleFor(g, settings) : "";
    const name = (g.name || "").trim();
    const model = settings.show_model ? (g.model || "").trim() : "";
    const price = priceFor(g, prices, settings);
    return `
    <div class="tag">
      <div class="tag-top">
        <div class="art">${article ? `Арт: ${esc(article)}` : ""}</div>
        <div class="name-block">
          <div class="name">${esc(name)}</div>
          ${model ? `<div class="model">${esc(model)}</div>` : ""}
        </div>
      </div>
      <div class="tag-mid">
        <img class="qr" src="${qrDataUrl}" />
        <div class="price-block">
          <span class="price">${price}</span>
          <span class="cur">руб.</span>
        </div>
      </div>
      <div class="tag-bot">${esc(settings.company_name || "Умный Дом")}</div>
    </div>`;
  };

  const pageHtml = (chunk: Good[]) => {
    const cells = [
      ...chunk.map(tagHtml),
      ...Array(PER_PAGE - chunk.length).fill('<div class="tag empty"></div>'),
    ].join("");
    return `<section class="page">${cells}</section>`;
  };

  const qrSizeLarge = isLarge ? Math.round(qrSize * 1.3) : qrSize;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Ценники</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111;
    font-family: Arial, "Segoe UI", system-ui, sans-serif; }
  .page {
    width: 210mm; height: 297mm; padding: 10mm;
    display: grid;
    grid-template-columns: repeat(${sz.cols}, ${sz.w}mm);
    grid-template-rows: repeat(${sz.rows}, ${sz.h}mm);
    gap: 3mm;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .tag {
    width: ${sz.w}mm; height: ${sz.h}mm;
    border: 0.3mm solid #ccc; border-radius: 1.5mm;
    padding: ${isLarge ? "3mm 3.5mm" : "2mm 2.5mm"};
    display: grid;
    grid-template-rows: auto 1fr ${sz.botH}mm;
    overflow: hidden;
  }
  .tag.empty { border: 0.3mm dashed #eee; }

  .tag-top { display: grid; grid-template-rows: auto auto; gap: 0.5mm; }
  .art { font-size: ${sz.artFont}pt; color: #888; min-height: ${isLarge ? "3mm" : "2.4mm"}; }
  .name-block { line-height: 1.15; }
  .name {
    font-weight: 700; color: #111;
    font-size: ${nameSize}pt;
    display: -webkit-box; -webkit-line-clamp: ${isLarge ? 4 : 3}; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .model {
    font-size: ${modelSize}pt; color: #666; margin-top: 0.5mm;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .tag-mid {
    display: grid;
    grid-template-columns: ${qrSizeLarge}mm 1fr;
    align-items: center;
    gap: ${isLarge ? "3mm" : "2mm"};
    border-top: 0.2mm solid #eee;
    border-bottom: 0.2mm solid #eee;
    padding: ${isLarge ? "2mm" : "1.5mm"} 0;
  }
  .qr { width: ${qrSizeLarge}mm; height: ${qrSizeLarge}mm; display: block; }
  .price-block {
    display: flex; align-items: baseline; gap: 1.5mm;
    justify-content: flex-end;
  }
  .price {
    font-weight: 800; font-size: ${sz.priceFont}pt; color: #111; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .cur { font-size: ${sz.curFont}pt; color: #444; }

  .tag-bot {
    text-align: center; font-size: ${sz.companyFont}pt; color: #555;
    padding-top: 1mm;
  }
</style>
</head>
<body>
${pages.map(pageHtml).join("\n")}
</body>
</html>`;
}

export { makeQrDataUrl };
