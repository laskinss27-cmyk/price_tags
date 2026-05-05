import React, { useEffect, useMemo, useState } from "react";
import type { Category, Good, PriceMap, TagSettings } from "../types";
import { CategoryTree } from "./CategoryTree";
import { GoodsTable } from "./GoodsTable";
import { SelectionPanel } from "./SelectionPanel";
import { SettingsDialog } from "./SettingsDialog";
import { buildTagsHtml } from "../tagsHtml";

interface Props {
  onLogout: () => void;
}

const DEFAULT_SETTINGS: TagSettings = {
  company_name: "Умный Дом",
  price_field: "price_sale",
  article_field: "id",
  show_article: true,
  show_model: true,
  qr_size_mm: 12,
  name_size_pt: 8,
  tag_size: "60x40",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "никогда";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function MainView({ onLogout }: Props) {
  const [cats, setCats] = useState<Category[]>([]);
  const [goods, setGoods] = useState<Good[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLoaded, setRefreshLoaded] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<PriceMap>({});
  const [settings, setSettings] = useState<TagSettings>(DEFAULT_SETTINGS);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [printing, setPrinting] = useState<"print" | "pdf" | null>(null);

  // Подписка на прогресс загрузки
  useEffect(() => {
    const off = window.api.onCatalogProgress((loaded) => setRefreshLoaded(loaded));
    return off;
  }, []);

  // Initial load из локального кэша
  useEffect(() => {
    (async () => {
      const [cat, p, s] = await Promise.all([
        window.api.getCatalog(),
        window.api.getPrices(),
        window.api.getSettings(),
      ]);
      setCats(cat.categories);
      setGoods(cat.goods);
      setSavedAt(cat.savedAt);
      setPrices(p);
      setSettings(s);
      // Если кэш пуст — сразу запускаем первый refresh
      if (cat.goods.length === 0) {
        void doRefresh();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doRefresh = async () => {
    setRefreshing(true);
    setRefreshLoaded(0);
    try {
      const fresh = await window.api.refreshCatalog();
      setCats(fresh.categories);
      setGoods(fresh.goods);
      setSavedAt(fresh.savedAt);
    } catch (e: any) {
      alert("Ошибка загрузки базы: " + (e?.message || String(e)));
    } finally {
      setRefreshing(false);
    }
  };

  // С учётом архивных
  const allGoods = useMemo(
    () => (showArchived ? goods : goods.filter((g) => String(g.archived ?? "0") === "0")),
    [goods, showArchived],
  );

  // map of category-id -> goods count (для отображения в дереве)
  const goodsCountByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of allGoods) {
      const list = (g.categories || []) as (string | number)[];
      for (const c of list) {
        const id = String(c);
        m[id] = (m[id] || 0) + 1;
      }
    }
    return m;
  }, [allGoods]);

  // Все потомки выбранной категории
  const descendantIds = useMemo(() => {
    if (!activeCat) return null;
    const byParent: Record<string, string[]> = {};
    for (const c of cats) (byParent[c.parent] ||= []).push(c.id);
    const set = new Set<string>([activeCat]);
    const stack = [activeCat];
    while (stack.length) {
      const id = stack.pop()!;
      for (const c of byParent[id] || []) {
        if (!set.has(c)) { set.add(c); stack.push(c); }
      }
    }
    return set;
  }, [activeCat, cats]);

  // Видимые товары
  const visibleGoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allGoods.filter((g) => {
      if (descendantIds) {
        const list = (g.categories || []) as (string | number)[];
        if (!list.some((c) => descendantIds.has(String(c)))) return false;
      }
      if (q) {
        // Поиск включает id, name, model, manufacturer_name, артикул-поле
        const blob = (
          String(g.id ?? "") + " " +
          (g.name || "") + " " +
          (g.model || "") + " " +
          (g.manufacturer_name || "") + " " +
          String(g[settings.article_field] ?? "")
        ).toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [allGoods, descendantIds, search, settings.article_field]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const selectAllVisible = () => {
    const next = new Set(selected);
    visibleGoods.forEach((g) => next.add(String(g.id)));
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());

  const updatePrice = async (id: string, price: number | null) => {
    setPrices((p) => {
      const n = { ...p };
      if (price === null) delete n[id]; else n[id] = price;
      return n;
    });
    try {
      const fresh = await window.api.setPrice(id, price);
      setPrices(fresh);
    } catch (e) {
      console.error("setPrice failed", e);
    }
  };

  const collectSelectedGoods = (): Good[] => {
    const map = new Map(goods.map((g) => [String(g.id), g]));
    const arr: Good[] = [];
    selected.forEach((id) => { const g = map.get(id); if (g) arr.push(g); });
    return arr;
  };

  const doPrint = async () => {
    const sel = collectSelectedGoods();
    if (sel.length === 0) { alert("Выберите хотя бы один товар."); return; }
    setPrinting("print");
    try {
      const html = await buildTagsHtml(sel, prices, settings);
      const r = await window.api.printTags(html, { showDialog: true });
      if (!r.success && r.failureReason && r.failureReason !== "cancelled") {
        alert("Печать не удалась: " + r.failureReason);
      }
    } catch (e: any) {
      alert("Ошибка: " + (e?.message || String(e)));
    } finally { setPrinting(null); }
  };

  const doSavePdf = async () => {
    const sel = collectSelectedGoods();
    if (sel.length === 0) { alert("Выберите хотя бы один товар."); return; }
    setPrinting("pdf");
    try {
      const html = await buildTagsHtml(sel, prices, settings);
      const path = await window.api.savePdf(html, "ценники.pdf");
      if (path) console.log("Saved:", path);
    } catch (e: any) {
      alert("Ошибка: " + (e?.message || String(e)));
    } finally { setPrinting(null); }
  };

  const onSaveSettings = async (s: TagSettings) => {
    const fresh = await window.api.setSettings(s);
    setSettings(fresh);
    setShowSettings(false);
  };

  const archivedCount = goods.length - goods.filter((g) => String(g.archived ?? "0") === "0").length;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="title">Печать ценников</div>
          <div className="sub">
            База: {goods.length} записей{archivedCount > 0 ? ` (${archivedCount} в архиве)` : ""}
            {" · "}
            обновлено {fmtDate(savedAt)}
            {refreshing && ` · загружаю… ${refreshLoaded}`}
          </div>
        </div>
        <div className="topbar-actions">
          <span className="counter">Выбрано: <b>{selected.size}</b></span>
          <button className="btn ghost" onClick={doRefresh} disabled={refreshing}>
            {refreshing ? "Обновление…" : "⟳ Обновить базу"}
          </button>
          <button className="btn ghost" onClick={() => setShowSettings(true)}>⚙ Настройка</button>
          <button className="btn secondary" onClick={doSavePdf} disabled={!!printing || refreshing}>
            {printing === "pdf" ? "Сохранение…" : "📄 PDF"}
          </button>
          <button className="btn primary" onClick={doPrint} disabled={!!printing || refreshing}>
            {printing === "print" ? "Печать…" : "🖨 Печать"}
          </button>
          <button className="btn ghost" onClick={onLogout} title="Выйти">↩</button>
        </div>
      </header>

      <main className={`main${selected.size > 0 ? " has-selection" : ""}`}>
        <aside className="sidebar">
          <h2>Категории</h2>
          <CategoryTree
            categories={cats}
            selectedId={activeCat}
            goodsCountByCategory={goodsCountByCategory}
            onSelect={setActiveCat}
          />
        </aside>

        <section className="panel">
          <div className="panel-head">
            <input
              className="search-input"
              placeholder="Поиск по ID, названию, модели, бренду, артикулу…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="counter" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              архив
            </label>
            <button className="btn ghost" onClick={selectAllVisible}>
              Выбрать все ({visibleGoods.length})
            </button>
            <button className="btn ghost" onClick={clearSelection}>Снять все</button>
          </div>
          {goods.length === 0 ? (
            <div className="empty">
              {refreshing
                ? `Загружаю каталог из API… ${refreshLoaded}`
                : "База пуста — нажмите «Обновить базу»."}
            </div>
          ) : (
            <GoodsTable
              goods={visibleGoods}
              selected={selected}
              prices={prices}
              settings={settings}
              onToggle={toggle}
              onPriceChange={updatePrice}
            />
          )}
          <div className="statusbar">
            <span>Показано: {visibleGoods.length} из {allGoods.length}</span>
            <span>Выбрано: {selected.size}</span>
            <span>Цены подменены вручную: {Object.keys(prices).length}</span>
          </div>
        </section>

        <SelectionPanel
          goods={goods}
          selected={selected}
          prices={prices}
          settings={settings}
          onRemove={toggle}
          onClear={clearSelection}
        />
      </main>

      {showSettings && (
        <SettingsDialog
          value={settings}
          onSave={onSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
