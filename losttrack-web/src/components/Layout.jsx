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
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "100%" }}>
      <SideNav />
      <div style={{ display: "grid", gridTemplateRows: "56px auto 1fr", height: "100%" }}>
        <TopBar />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 16px",
            borderBottom: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          <div style={{ color: "#555" }}>
            Eingeloggt als: <b>{userName || "—"}</b>
          </div>
          <button onClick={onLogout} style={{ cursor: "pointer" }}>
            Abmelden
          </button>
        </div>

        <main style={{ padding: 16 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
