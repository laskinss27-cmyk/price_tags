import React, { useEffect, useState } from "react";
import { Login } from "./components/Login";
import { MainView } from "./components/MainView";

const LS_LOGIN = "price_tags_last_login";

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [savedLogin, setSavedLogin] = useState<string>("");

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

  return (
    <MainView
      onLogout={async () => {
        await window.api.logout();
        setAuthed(false);
      }}
    />
  );
}
