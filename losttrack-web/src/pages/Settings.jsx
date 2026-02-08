// src/pages/Settings.jsx
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getCurrentUser } from "../core/storage/userRepo";
import { can } from "../core/auth/permissions";

const tabStyle = ({ isActive }) => ({
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  background: isActive ? "rgba(78,161,255,0.18)" : "transparent",
  border: "1px solid " + (isActive ? "rgba(78,161,255,0.35)" : "transparent"),
});

export default function Settings() {
  const me = getCurrentUser();
  const showUsers = can(me, "USER_MANAGE");

  return (
    <section style={{ maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 10px 0" }}>Einstellungen</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <NavLink to="/einstellungen" end style={tabStyle}>
          Übersicht
        </NavLink>

        {showUsers && (
          <NavLink to="/einstellungen/benutzer" style={tabStyle}>
            Benutzer
          </NavLink>
        )}
      </div>

      <Outlet />
    </section>
  );
}
