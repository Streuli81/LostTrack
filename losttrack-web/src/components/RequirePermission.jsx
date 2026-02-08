// src/components/RequirePermission.jsx
import React from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "../core/storage/userRepo";
import { can } from "../core/auth/permissions";

export default function RequirePermission({ action, children }) {
  const me = getCurrentUser();

  if (can(me, action)) return children;

  return (
    <section style={{ maxWidth: 1100 }}>
      <h2>Keine Berechtigung</h2>
      <p style={{ opacity: 0.8 }}>
        Aktueller Benutzer: <strong>{me?.name || "—"}</strong> ({me?.role || "—"})
        <br />
        Für diese Funktion brauchst du: <strong>{action}</strong>
      </p>
      <p>
        <Link to="/">← zurück</Link>
      </p>
    </section>
  );
}
