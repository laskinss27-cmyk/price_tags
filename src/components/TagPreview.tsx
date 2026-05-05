import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Good, PriceMap, TagSettings } from "../types";
import { buildTagsHtmlSync, makeQrDataUrl } from "../tagsHtml";

interface Props {
  settings: TagSettings;
  prices?: PriceMap;
}

const SAMPLES: Good[] = [
  { id: "1001", name: "Датчик движения потолочный 360° с сенсором освещённости", model: "PMM-240-WiFi", manufacturer_name: "HitePRO", price_sale: 4590, price_goodsale: 3200, categories: [] },
  { id: "1002", name: "Реле DIN 16А", model: "Relay-16A", manufacturer_name: "HitePRO", price_sale: 3290, price_goodsale: 2800, categories: [] },
  { id: "1003", name: "Умный шлюз Gateway", model: "GW-01", manufacturer_name: "HitePRO", price_sale: 7490, price_goodsale: 6200, categories: [] },
  { id: "1004", name: "Датчик протечки воды Smart Water", model: "SW-100", manufacturer_name: "HitePRO", price_sale: 2190, price_goodsale: 1800, categories: [] },
  { id: "1005", name: "Выключатель сенсорный 2 клавиши", model: "Touch-2G", manufacturer_name: "HitePRO", price_sale: 5690, price_goodsale: 4900, categories: [] },
  { id: "1006", name: "Диммер универсальный 300Вт", model: "DIM-300", manufacturer_name: "HitePRO", price_sale: 4890, price_goodsale: 4100, categories: [] },
];

const A4_W = 210 * 3.78;
const A4_H = 297 * 3.78;

export function TagPreview({ settings, prices }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [scale, setScale] = useState(0.3);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    makeQrDataUrl().then(setQrDataUrl);
  }, []);

  const updateScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw === 0 || ch === 0) return;
    const s = Math.min(cw / A4_W, ch / A4_H);
    setScale(s);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    updateScale();
    return () => ro.disconnect();
  }, [updateScale]);

  const perPage = settings.tag_size === "90x65" ? 8 : 18;
  const sampleGoods = SAMPLES.slice(0, Math.min(SAMPLES.length, perPage));

  const html = useMemo(() => {
    if (!qrDataUrl) return "";
    return buildTagsHtmlSync(sampleGoods, prices || {}, settings, qrDataUrl);
  }, [qrDataUrl, settings, prices, perPage]);

  if (!html) return null;

  return (
    <div className="tag-preview-wrap">
      <div className="tag-preview-a4" ref={containerRef}>
        <iframe
          srcDoc={html}
          sandbox=""
          style={{
            border: "none",
            width: A4_W,
            height: A4_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            display: "block",
          }}
          title="Превью листа A4"
        />
      </div>
      <div className="tag-preview-label">
        {settings.tag_size === "90x65" ? "90 × 65 мм · 8 шт/лист (2×4)" : "60 × 40 мм · 18 шт/лист (3×6)"}
      </div>
    </div>
  );
}
