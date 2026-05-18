import React, { useEffect, useState } from "react";
import { Login } from "./components/Login";
import { MainView } from "./components/MainView";
import { ClientsView } from "./components/ClientsView";

const LS_LOGIN = "price_tags_last_login";

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [savedLogin, setSavedLogin] = useState<string>("");
  const [tab, setTab] = useState<"goods" | "clients">("goods");

  // Сначала проверяем, есть ли живая сессия в Electron-партиции.
  useEffect(() => {
    setSavedLogin(localStorage.getItem(LS_LOGIN) || "");
    window.api.checkAuth().then((ok) => setAuthed(ok));
  }, []);

  if (authed === null) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: "center", color: "#7a84a8" }}>
          Подключение…
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <Login
        defaultUsername={savedLogin}
        onSuccess={(username) => {
          localStorage.setItem(LS_LOGIN, username);
          setAuthed(true);
        }}
      />
    );
  }

  const logout = async () => {
    await window.api.logout();
    setAuthed(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{
        display: "flex",
        gap: 4,
        padding: "6px 12px 0",
        borderBottom: "1px solid #2a3050",
        background: "#0f1115",
      }}>
        <button
          className={`btn ${tab === "goods" ? "primary" : "ghost"}`}
          onClick={() => setTab("goods")}
        >Товары</button>
        <button
          className={`btn ${tab === "clients" ? "primary" : "ghost"}`}
          onClick={() => setTab("clients")}
        >Клиенты</button>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={logout} title="Выйти">↩</button>
      </div>
      {tab === "goods" ? <MainView onLogout={logout} /> : <ClientsView />}
    </div>
  );
}
