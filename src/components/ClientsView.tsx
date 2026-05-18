import React, { useEffect, useMemo, useState } from "react";
import type { Client, ClientsOverlay } from "../types";

function fmtDate(iso: string | null): string {
  if (!iso) return "никогда";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// Человекочитаемые подписи к известным полям. Неизвестные — выводим как есть (id поля).
const FIELD_LABELS: Record<string, string> = {
  id: "ID",
  user: "Менеджер",
  user_change: "Кто изменил",
  name: "Название",
  fio: "ФИО",
  phone: "Телефон",
  email: "E-mail",
  address: "Адрес",
  status: "Статус",
  sum_stat: "Сумма",
  date_of_birth: "Дата рождения",
  date_create: "Создан",
  date_change: "Изменён",
  discount_card_number: "Скидочная карта",
  next_call_date: "След. звонок",
};

const PRIORITY = [
  "id", "name", "fio", "phone", "email", "address", "status",
  "sum_stat", "discount_card_number", "date_of_birth", "next_call_date",
  "user", "user_change", "date_create", "date_change",
];

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s === "0" || s === "null";
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

const EMPTY_OVERLAY: ClientsOverlay = { deletedIds: [], edits: {} };

export function ClientsView() {
  const [rawClients, setRawClients] = useState<Client[]>([]);
  const [overlay, setOverlay] = useState<ClientsOverlay>(EMPTY_OVERLAY);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLoaded, setRefreshLoaded] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showEmpty, setShowEmpty] = useState(true);
  const [page, setPage] = useState(0);
  const [perPage] = useState(50);
  const [fltManager, setFltManager] = useState<string>("");
  const [fltStatus, setFltStatus] = useState<string>("");
  const [fltOnlyPhone, setFltOnlyPhone] = useState(false);
  const [fltOnlyEmail, setFltOnlyEmail] = useState(false);
  const [fltOnlyAddress, setFltOnlyAddress] = useState(false);

  useEffect(() => {
    const off = window.api.onClientsProgress((loaded) => setRefreshLoaded(loaded));
    return off;
  }, []);

  useEffect(() => {
    (async () => {
      const c = await window.api.getClients();
      setRawClients(c.clients);
      setOverlay(c.overlay || EMPTY_OVERLAY);
      setSavedAt(c.savedAt);
    })();
  }, []);

  const doRefresh = async () => {
    setRefreshing(true);
    setRefreshLoaded(0);
    try {
      const fresh = await window.api.refreshClients();
      setRawClients(fresh.clients);
      setOverlay(fresh.overlay || EMPTY_OVERLAY);
      setSavedAt(fresh.savedAt);
    } catch (e: any) {
      alert("Ошибка загрузки клиентов: " + (e?.message || String(e)));
    } finally {
      setRefreshing(false);
    }
  };

  // Накладываем оверлей: правки мёрджим, удалённых либо прячем, либо помечаем флагом.
  const clients = useMemo(() => {
    const deleted = new Set(overlay.deletedIds);
    return rawClients.map((c) => {
      const id = String(c.id);
      const patch = overlay.edits[id];
      const merged = patch ? { ...c, ...patch } : c;
      return { ...merged, _deleted: deleted.has(id), _edited: !!patch };
    });
  }, [rawClients, overlay]);

  // Уникальные значения полей — для выпадающих фильтров.
  const managers = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => { if (c.user) s.add(String(c.user)); });
    return Array.from(s).sort();
  }, [clients]);
  const statuses = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => { if (c.status) s.add(String(c.status)); });
    return Array.from(s).sort();
  }, [clients]);

  // Применение всех фильтров + поиск (без пагинации).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (!showDeleted && c._deleted) return false;
      if (fltManager && String(c.user || "") !== fltManager) return false;
      if (fltStatus && String(c.status || "") !== fltStatus) return false;
      if (fltOnlyPhone && !c.phone) return false;
      if (fltOnlyEmail && !c.email) return false;
      if (fltOnlyAddress && !c.address) return false;
      if (q) {
        for (const k in c) {
          const v = c[k];
          if (v == null) continue;
          if (typeof v === "object") continue;
          if (String(v).toLowerCase().includes(q)) return true;
        }
        return false;
      }
      return true;
    });
  }, [clients, search, fltManager, fltStatus, fltOnlyPhone, fltOnlyEmail, fltOnlyAddress, showDeleted]);

  // Сбрасываем страницу при смене фильтра/поиска.
  useEffect(() => { setPage(0); }, [search, fltManager, fltStatus, fltOnlyPhone, fltOnlyEmail, fltOnlyAddress, showDeleted]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages - 1);
  const visible = useMemo(
    () => filtered.slice(curPage * perPage, (curPage + 1) * perPage),
    [filtered, curPage, perPage],
  );

  // Экспорт всего отфильтрованного списка в CSV для Excel (UTF-8 BOM, ;-разделитель).
  const exportCsv = () => {
    if (filtered.length === 0) { alert("Нет клиентов для экспорта."); return; }
    // Все поля, которые встречаются хотя бы у одного клиента.
    const allKeys = new Set<string>();
    filtered.forEach((c) => Object.keys(c).forEach((k) => {
      if (typeof c[k] !== "object") allKeys.add(k);
    }));
    const keys = Array.from(allKeys).sort((a, b) => {
      const ia = PRIORITY.indexOf(a);
      const ib = PRIORITY.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      if (s.includes(";") || s.includes("\"") || s.includes("\n")) {
        return "\"" + s.replace(/"/g, "\"\"") + "\"";
      }
      return s;
    };
    const lines = [
      keys.map((k) => escape(FIELD_LABELS[k] || k)).join(";"),
      ...filtered.map((c) => keys.map((k) => escape(c[k])).join(";")),
    ];
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selected = useMemo(
    () => clients.find((c) => String(c.id) === selectedId) || null,
    [clients, selectedId],
  );

  // При смене выбранного клиента — выходим из режима правки.
  useEffect(() => { setEditing(false); setDraft({}); }, [selectedId]);

  const startEdit = () => {
    if (!selected) return;
    const d: Record<string, string> = {};
    Object.keys(selected).forEach((k) => {
      if (k.startsWith("_")) return;
      const v = selected[k];
      if (typeof v === "object") return;
      d[k] = v == null ? "" : String(v);
    });
    setDraft(d);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    const id = String(selected.id);
    // В patch кладём только то, что реально изменилось vs raw-клиента.
    const raw = rawClients.find((c) => String(c.id) === id);
    const patch: Record<string, any> = {};
    Object.keys(draft).forEach((k) => {
      const before = raw ? (raw[k] == null ? "" : String(raw[k])) : "";
      if (draft[k] !== before) patch[k] = draft[k];
    });
    if (Object.keys(patch).length === 0) { setEditing(false); return; }
    const o = await window.api.clientEditLocal(id, patch);
    setOverlay(o);
    setEditing(false);
  };

  const doDelete = async () => {
    if (!selected) return;
    const id = String(selected.id);
    if (!confirm("Удалить клиента из локальной базы? Сервер не затрагивается, восстановить можно через «показать удалённых».")) return;
    const o = await window.api.clientDeleteLocal(id);
    setOverlay(o);
  };

  const doRestore = async () => {
    if (!selected) return;
    const o = await window.api.clientRestoreLocal(String(selected.id));
    setOverlay(o);
  };

  const doResetEdits = async () => {
    if (!selected) return;
    if (!confirm("Сбросить локальные правки этого клиента и вернуть данные с сервера?")) return;
    const o = await window.api.clientResetLocal(String(selected.id));
    setOverlay(o);
  };

  const sortedFields = (c: Client): [string, unknown][] => {
    const keys = Object.keys(c);
    keys.sort((a, b) => {
      const ia = PRIORITY.indexOf(a);
      const ib = PRIORITY.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return keys
      .filter((k) => showEmpty || !isEmpty(c[k]))
      .map((k) => [k, c[k]]);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      flex: 1,
      padding: 12,
      gap: 8,
      minHeight: 0,
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="search-input"
          placeholder="Поиск: имя, ФИО, телефон, email, адрес…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          style={{ flex: "1 1 280px", minWidth: 200 }}
        />
        <button className="btn ghost" onClick={doRefresh} disabled={refreshing}>
          {refreshing ? `Загрузка… ${refreshLoaded}` : "⟳ Обновить"}
        </button>
        <button className="btn ghost" onClick={exportCsv} disabled={filtered.length === 0}>
          📊 Excel
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "#7a84a8" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Менеджер:
          <select value={fltManager} onChange={(e) => setFltManager(e.target.value)}
            style={{ background: "#0f1115", color: "#e6e8ee", border: "1px solid #2a3050", borderRadius: 4, padding: "2px 6px" }}>
            <option value="">— все —</option>
            {managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Статус:
          <select value={fltStatus} onChange={(e) => setFltStatus(e.target.value)}
            style={{ background: "#0f1115", color: "#e6e8ee", border: "1px solid #2a3050", borderRadius: 4, padding: "2px 6px" }}>
            <option value="">— все —</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={fltOnlyPhone} onChange={(e) => setFltOnlyPhone(e.target.checked)} />
          с телефоном
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={fltOnlyEmail} onChange={(e) => setFltOnlyEmail(e.target.checked)} />
          с email
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={fltOnlyAddress} onChange={(e) => setFltOnlyAddress(e.target.checked)} />
          с адресом
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          показать удалённых ({overlay.deletedIds.length})
        </label>
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
          пустые поля
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
          сырой JSON
        </label>
      </div>

      {clients.length === 0 ? (
        <div className="empty" style={{ padding: 24, textAlign: "center", color: "#7a84a8" }}>
          {refreshing
            ? `Загружаю клиентов… ${refreshLoaded}`
            : "База клиентов пуста — нажмите «Обновить клиентов»."}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}>
          {/* Список */}
          <div style={{
            overflowY: "auto",
            border: "1px solid #2a3050",
            borderRadius: 8,
          }}>
            {visible.map((c) => {
              const id = String(c.id);
              const isSel = id === selectedId;
              const title = c.name || c.fio || `Клиент ${id}`;
              const sub = [c.phone, c.email].filter(Boolean).join(" · ");
              return (
                <div
                  key={id}
                  onClick={() => setSelectedId(id)}
                  style={{
                    padding: "8px 10px",
                    borderBottom: "1px solid #1c2138",
                    cursor: "pointer",
                    background: isSel ? "#1c2750" : "transparent",
                    opacity: c._deleted ? 0.45 : 1,
                    textDecoration: c._deleted ? "line-through" : undefined,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {title}
                    {c._edited && <span title="есть локальные правки" style={{ color: "#fbbf24", marginLeft: 6 }}>✎</span>}
                  </div>
                  {sub && <div style={{ fontSize: 12, color: "#7a84a8" }}>{sub}</div>}
                </div>
              );
            })}
            {visible.length === 0 && (
              <div style={{ padding: 12, color: "#7a84a8" }}>Ничего не найдено</div>
            )}
          </div>

          {/* Карточка */}
          <div style={{
            overflowY: "auto",
            border: "1px solid #2a3050",
            borderRadius: 8,
            padding: 16,
          }}>
            {selected ? (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  {!editing && !selected._deleted && (
                    <button className="btn ghost" onClick={startEdit}>✎ Редактировать</button>
                  )}
                  {editing && (
                    <>
                      <button className="btn primary" onClick={saveEdit}>Сохранить</button>
                      <button className="btn ghost" onClick={() => { setEditing(false); setDraft({}); }}>Отмена</button>
                    </>
                  )}
                  {!editing && selected._edited && (
                    <button className="btn ghost" onClick={doResetEdits} title="Сбросить локальные правки">↶ Сброс правок</button>
                  )}
                  {!editing && !selected._deleted && (
                    <button className="btn ghost" onClick={doDelete} style={{ color: "#f87171" }}>🗑 Удалить</button>
                  )}
                  {!editing && selected._deleted && (
                    <button className="btn primary" onClick={doRestore}>↩ Восстановить</button>
                  )}
                  {selected._deleted && (
                    <span style={{ color: "#f87171", alignSelf: "center", fontSize: 12 }}>
                      (помечен как удалённый локально)
                    </span>
                  )}
                </div>
                {showRaw ? (
                  <pre style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#b8bdcb",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>{JSON.stringify(selected, null, 2)}</pre>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {sortedFields(selected).map(([k, v]) => {
                        const empty = isEmpty(v);
                        return (
                          <tr key={k} style={{ borderBottom: "1px solid #1c2138" }}>
                            <td style={{
                              padding: "6px 12px 6px 0",
                              color: "#7a84a8",
                              verticalAlign: "top",
                              width: 180,
                              whiteSpace: "nowrap",
                            }}>
                              {FIELD_LABELS[k] || k}
                            </td>
                            <td style={{
                              padding: "6px 0",
                              wordBreak: "break-word",
                              color: empty && !editing ? "#525a70" : undefined,
                              fontStyle: empty && !editing ? "italic" : undefined,
                            }}>
                              {editing ? (
                                <input
                                  value={draft[k] ?? ""}
                                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                                  style={{
                                    width: "100%",
                                    background: "#0f1115",
                                    color: "#e6e8ee",
                                    border: "1px solid #2a3050",
                                    borderRadius: 4,
                                    padding: "4px 6px",
                                  }}
                                />
                              ) : (
                                empty ? "(пусто)" : fmtValue(v)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <div style={{ color: "#7a84a8" }}>Выберите клиента из списка слева</div>
            )}
          </div>
        </div>
      )}

      <div style={{
        display: "flex",
        gap: 12,
        fontSize: 12,
        color: "#7a84a8",
        padding: "4px 4px 0",
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        <span>Всего: {clients.length}</span>
        <span>После фильтров: {filtered.length}</span>
        <span>Обновлено: {fmtDate(savedAt)}</span>
        <div style={{ flex: 1 }} />
        {filtered.length > perPage && (
          <>
            <button className="btn ghost" onClick={() => setPage(0)} disabled={curPage === 0}>«</button>
            <button className="btn ghost" onClick={() => setPage(curPage - 1)} disabled={curPage === 0}>‹</button>
            <span>Стр. {curPage + 1} из {totalPages}</span>
            <button className="btn ghost" onClick={() => setPage(curPage + 1)} disabled={curPage >= totalPages - 1}>›</button>
            <button className="btn ghost" onClick={() => setPage(totalPages - 1)} disabled={curPage >= totalPages - 1}>»</button>
          </>
        )}
      </div>
    </div>
  );
}
