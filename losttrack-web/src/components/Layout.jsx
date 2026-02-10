import { Outlet, useNavigate } from "react-router-dom";
import SideNav from "./SideNav.jsx";
import TopBar from "./TopBar.jsx";
import { getCurrentUserName, logout } from "../core/auth/auth.js";

export default function Layout() {
  const nav = useNavigate();
  const userName = getCurrentUserName();

  function onLogout() {
    logout();
    nav("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      {/* ---------- SIDEBAR ---------- */}
      <aside className="app-sidebar">
        <SideNav />
      </aside>

      {/* ---------- MAIN ---------- */}
      <div className="app-main">
        {/* Topbar (Navigation / Titel etc.) */}
        <header className="app-topbar">
          <TopBar />
        </header>

        {/* Benutzerleiste */}
        <div className="app-userbar">
          <div style={{ color: "#555" }}>
            Eingeloggt als: <b>{userName || "—"}</b>
          </div>
          <button
            onClick={onLogout}
            style={{
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 6,
            }}
          >
            Abmelden
          </button>
        </div>

        {/* Seiteninhalt */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
