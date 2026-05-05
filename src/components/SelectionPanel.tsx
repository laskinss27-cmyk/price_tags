import React from "react";
import type { Good, PriceMap, TagSettings } from "../types";
import { fmtPrice, toNumber } from "../utils";

interface Props {
  goods: Good[];
  selected: Set<string>;
  prices: PriceMap;
  settings: TagSettings;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function SelectionPanel({ goods, selected, prices, settings, onRemove, onClear }: Props) {
  if (selected.size === 0) return null;

  const goodsMap = new Map(goods.map((g) => [String(g.id), g]));
  const items: Good[] = [];
  selected.forEach((id) => {
    const g = goodsMap.get(id);
    if (g) items.push(g);
  });

  const priceOf = (g: Good): string => {
    const id = String(g.id);
    if (prices[id] !== undefined) return fmtPrice(prices[id]);
    return fmtPrice(g[settings.price_field]);
  };

  return (
    <aside className="sel-panel">
      <div className="sel-panel-head">
        <h2>К печати ({items.length})</h2>
        <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={onClear}>
          Очистить
        </button>
      </div>
      <div className="sel-panel-list">
        {items.map((g) => {
          const id = String(g.id);
          return (
            <div className="sel-item" key={id}>
              <div className="sel-item-info">
                <div className="sel-item-name">{g.name || "—"}</div>
                <div className="sel-item-price">{priceOf(g)} ₽</div>
              </div>
              <button
                className="sel-item-remove"
                title="Убрать из списка"
                onClick={() => onRemove(id)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
