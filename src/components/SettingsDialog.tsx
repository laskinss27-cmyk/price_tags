import React, { useState } from "react";
import type { TagSettings } from "../types";
import { TagPreview } from "./TagPreview";

interface Props {
  value: TagSettings;
  onSave: (s: TagSettings) => void;
  onClose: () => void;
}

export function SettingsDialog({ value, onSave, onClose }: Props) {
  const [s, setS] = useState<TagSettings>({ ...value });
  const set = <K extends keyof TagSettings>(k: K, v: TagSettings[K]) => setS({ ...s, [k]: v });

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Настройка ценника</h3>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
        <div className="settings-layout">
          <div className="settings-controls">
            <div className="field-row">
              <label>Размер ценника</label>
              <div className="tag-size-picker">
                <button
                  className={"btn " + (s.tag_size === "60x40" ? "primary" : "ghost")}
                  onClick={() => set("tag_size", "60x40")}
                >
                  60 × 40 мм
                </button>
                <button
                  className={"btn " + (s.tag_size === "90x65" ? "primary" : "ghost")}
                  onClick={() => set("tag_size", "90x65")}
                >
                  90 × 65 мм
                </button>
              </div>
            </div>

            <div className="field-row">
              <label>Название компании (нижний колонтитул)</label>
              <input
                type="text"
                value={s.company_name}
                onChange={(e) => set("company_name", e.target.value)}
              />
            </div>

            <div className="field-row">
              <label>Какую цену брать</label>
              <select
                value={s.price_field}
                onChange={(e) => set("price_field", e.target.value as TagSettings["price_field"])}
              >
                <option value="price_sale">Розничная (price_sale)</option>
                <option value="price_goodsale">Оптовая (price_goodsale)</option>
              </select>
            </div>

            <div className="field-row">
              <label>Поле артикула из API</label>
              <input
                type="text"
                value={s.article_field}
                onChange={(e) => set("article_field", e.target.value)}
                placeholder="id"
              />
            </div>

            <div className="field-inline">
              <label className="field-inline">
                <input
                  type="checkbox"
                  checked={s.show_article}
                  onChange={(e) => set("show_article", e.target.checked)}
                />{" "}
                Показывать артикул
              </label>
              <label className="field-inline">
                <input
                  type="checkbox"
                  checked={s.show_model}
                  onChange={(e) => set("show_model", e.target.checked)}
                />{" "}
                Показывать модель
              </label>
            </div>

            <div className="field-row">
              <label>Размер QR (мм)</label>
              <div className="range-row">
                <input
                  type="range"
                  min={8}
                  max={22}
                  step={1}
                  value={s.qr_size_mm}
                  onChange={(e) => set("qr_size_mm", Number(e.target.value))}
                />
                <span className="rval">{s.qr_size_mm} мм</span>
              </div>
            </div>

            <div className="field-row">
              <label>Размер шрифта названия (пт)</label>
              <div className="range-row">
                <input
                  type="range"
                  min={6}
                  max={18}
                  step={0.5}
                  value={s.name_size_pt}
                  onChange={(e) => set("name_size_pt", Number(e.target.value))}
                />
                <span className="rval">{s.name_size_pt} пт</span>
              </div>
            </div>
          </div>

          <div className="settings-preview">
            <div className="settings-preview-label">Превью</div>
            <TagPreview settings={s} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={() => onSave(s)}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}
