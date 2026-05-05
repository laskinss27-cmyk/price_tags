import React, { useState } from "react";

interface Props {
  defaultUsername: string;
  onSuccess: (username: string) => void;
}

export function Login({ defaultUsername, onSuccess }: Props) {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username.trim() || !password) {
      setErr("Введите логин и пароль");
      return;
    }
    setBusy(true);
    setErr("");
    const r = await window.api.login(username.trim(), password);
    setBusy(false);
    if (r.ok) onSuccess(username.trim());
    else setErr(r.message || "Ошибка входа");
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1 className="login-title">Печать ценников</h1>
        <p className="login-sub">dom-automation.ru</p>

        <label>Пользователь</label>
        <input
          type="text"
          value={username}
          autoFocus
          onChange={(e) => setUsername(e.target.value)}
        />

        <label>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" className="login-btn" disabled={busy}>
          {busy ? "Подключение…" : "Войти"}
        </button>

        {err && <div className="login-error">{err}</div>}
      </form>
    </div>
  );
}
