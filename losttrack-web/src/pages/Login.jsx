// src/pages/Login.jsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, isLoggedIn } from "../core/auth/auth.js";

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = useMemo(() => params.get("next") || "/", [params]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (isLoggedIn()) nav(next, { replace: true });

  function onSubmit(e) {
    e.preventDefault();
    setErr("");
    const res = login({ username, password });
    if (!res.ok) return setErr(res.error || "Login fehlgeschlagen.");
    nav(next, { replace: true });
  }

  return (
    <section style={{ maxWidth: 420, margin: "32px auto" }}>
      <h2>Login</h2>
      <p style={{ marginTop: 6, color: "#666" }}>
        Default v1: <b>admin</b> / <b>admin</b>
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Benutzername</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Passwort</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {err ? (
          <div style={{ background: "#ffe9e9", border: "1px solid #ffb3b3", padding: 10 }}>
            {err}
          </div>
        ) : null}

        <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
          Anmelden
        </button>
      </form>
    </section>
  );
}
