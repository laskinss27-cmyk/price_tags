import React, { useState } from "react";
import type { Good, PriceMap, TagSettings } from "../types";
import { fmtPrice, isStubPrice, toNumber } from "../utils";

interface Props {
  goods: Good[];
  selected: Set<string>;
  prices: PriceMap;
  settings: TagSettings;
  onToggle: (id: string) => void;
  onPriceChange: (id: string, price: number | null) => void;
}

interface PriceInputProps {
  id: string;
  apiPrice: unknown;
  override: number | undefined;
  onChange: (price: number | null) => void;
}

function PriceCell({ id, apiPrice, override, onChange }: PriceInputProps) {
  const isOverride = override !== undefined;
  const initial = isOverride ? String(override) : (apiPrice == null ? "" : String(toNumber(apiPrice) || ""));
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);

  // Внешний апдейт перекрывает черновик, если не редактируем
  React.useEffect(() => {
    if (!editing) setDraft(initial);
  }, [initial, editing]);

  const stub = isStubPrice(apiPrice) && !isOverride;

  const commit = () => {
    setEditing(false);
    const n = Number(draft.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      onChange(null);
    } else {
      const apiNum = toNumber(apiPrice);
      if (Number.isFinite(apiNum) && Math.round(apiNum) === Math.round(n)) {
        onChange(null); // совпало с API — снимаем override
      } else {
        onChange(n);
      }
    }
  };

  return (
    <div className="price-cell">
      {stub && <span className="stub" title="Похоже на цену-заглушку">⚠</span>}
      <input
        type="number"
        className="price-input"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setEditing(true); }}
        onFocus={() => setEditing(true)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        min={0}
        step={1}
      />
      {isOverride && (
        <button
          className="price-reset"
          title="Сбросить к цене из API"
          onClick={() => { onChange(null); }}
        >
          ↺
        </button>
      )}
    </div>
  );
}

export function GoodsTable({
  goods,
  selected,
  prices,
  settings,
  onToggle,
  onPriceChange,
}: Props) {
  if (goods.length === 0) {
    return <div className="empty">Ничего не найдено</div>;
  }
  const allChecked = goods.length > 0 && goods.every((g) => selected.has(String(g.id)));

  return (
    <div className="tbl-wrap">
      <table className="goods">
        <thead>
          <tr>
            <th className="chk">
              <span
                className={"checkbox" + (allChecked ? " on" : "")}
                onClick={() => {
                  if (allChecked) goods.forEach((g) => selected.has(String(g.id)) && onToggle(String(g.id)));
                  else goods.forEach((g) => !selected.has(String(g.id)) && onToggle(String(g.id)));
                }}
              />
            </th>
            <th>Название</th>
            <th>Модель / Артикул</th>
            <th>Бренд</th>
            <th className="right">Цена</th>
          </tr>
        </thead>
        <tbody>
          {goods.map((g) => {
            const id = String(g.id);
            const isSel = selected.has(id);
            const apiPrice = g[settings.price_field];
            const override = prices[id];
            return (
              <tr key={id} className={isSel ? "checked" : ""}>
                <td className="chk" onClick={() => onToggle(id)}>
                  <span className={"checkbox" + (isSel ? " on" : "")} />
                </td>
                <td>
                  <div className="row-name">{g.name || "—"}</div>
                </td>
                <td className="muted">{g.model || ""}</td>
                <td className="muted">{g.manufacturer_name || ""}</td>
                <td className="right">
                  <PriceCell
                    id={id}
                    apiPrice={apiPrice}
                    override={override}
                    onChange={(p) => onPriceChange(id, p)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
