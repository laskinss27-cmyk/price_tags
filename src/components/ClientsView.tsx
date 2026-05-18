import React, { useEffect, useMemo, useState } from "react";
import type { Client } from "../types";

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

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLoaded, setRefreshLoaded] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const off = window.api.onClientsProgress((loaded) => setRefreshLoaded(loaded));
    return off;
  }, []);

  useEffect(() => {
    (async () => {
      const c = await window.api.getClients();
      setClients(c.clients);
      setSavedAt(c.savedAt);
    })();
  }, []);

  const doRefresh = async () => {
    setRefreshing(true);
    setRefreshLoaded(0);
    try {
      const fresh = await window.api.refreshClients();
      setClients(fresh.clients);
      setSavedAt(fresh.savedAt);
    } catch (e: any) {
      alert("Ошибка загрузки клиентов: " + (e?.message || String(e)));
    } finally {
      setRefreshing(false);
    }
  };

  // Поиск: по любому строковому полю клиента.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 500);
    return clients.filter((c) => {
      for (const k in c) {
        const v = c[k];
        if (v == null) continue;
        if (typeof v === "object") continue;
        if (String(v).toLowerCase().includes(q)) return true;
      }
      return false;
    }).slice(0, 500);
  }, [clients, search]);

  const selected = useMemo(
    () => clients.find((c) => String(c.id) === selectedId) || null,
    [clients, selectedId],
  );

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
    return keys.filter((k) => !isEmpty(c[k])).map((k) => [k, c[k]]);
  };

  return (
    <main className="main">
      <section className="panel" style={{ flex: 1 }}>
        <div className="panel-head">
          <input
            className="search-input"
            placeholder="Поиск: имя, ФИО, телефон, email, адрес…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <button className="btn ghost" onClick={doRefresh} disabled={refreshing}>
            {refreshing ? `Загрузка… ${refreshLoaded}` : "⟳ Обновить клиентов"}
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="empty">
            {refreshing
              ? `Загружаю клиентов… ${refreshLoaded}`
              : "База клиентов пуста — нажмите «Обновить клиентов»."}
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 12 }}>
            {/* Список */}
            <div style={{
              flex: "0 0 360px",
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
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{title}</div>
                    {sub && <div style={{ fontSize: 12, color: "#7a84a8" }}>{sub}</div>}
                  </div>
                );
              })}
              {visible.length === 0 && (
                <div style={{ padding: 12, color: "#7a84a8" }}>
                  Ничего не найдено
                </div>
              )}
            </div>

            {/* Карточка */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              border: "1px solid #2a3050",
              borderRadius: 8,
              padding: 16,
            }}>
              {selected ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {sortedFields(selected).map(([k, v]) => (
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
                        <td style={{ padding: "6px 0", wordBreak: "break-word" }}>
                          {fmtValue(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: "#7a84a8" }}>Выберите клиента из списка слева</div>
              )}
            </div>
          </div>
        )}

        <div className="statusbar">
          <span>Всего клиентов: {clients.length}</span>
          <span>Показано: {visible.length}</span>
          <span>Обновлено: {fmtDate(savedAt)}</span>
        </div>
      </section>
    </main>
  );
}
