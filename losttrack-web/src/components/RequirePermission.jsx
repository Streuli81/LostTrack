// src/components/RequirePermission.jsx
import { Navigate, useLocation } from "react-router-dom";
import { hasPermission, isLoggedIn } from "../core/auth/auth.js";

export default function RequirePermission({ action, children }) {
  const loc = useLocation();

  if (!isLoggedIn()) {
    const next = encodeURIComponent(loc.pathname + (loc.search || ""));
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!action) return children;

  if (!hasPermission(action)) {
    return (
      <section style={{ maxWidth: 900 }}>
        <h2>Kein Zugriff</h2>
        <p>Dir fehlt die Berechtigung: <b>{action}</b></p>
        <p>Bitte melde dich mit einem berechtigten Benutzer an oder kontaktiere einen Admin.</p>
      </section>
    );
  }

  return children;
}
