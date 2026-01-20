import { NavLink } from "react-router-dom";

const linkStyle = ({ isActive }) => ({
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  background: isActive ? "rgba(78,161,255,0.18)" : "transparent",
  border: "1px solid " + (isActive ? "rgba(78,161,255,0.35)" : "transparent"),
});

export default function SideNav() {
  return (
    <aside style={{ padding: 16, borderRight: "1px solid var(--border)", background: "var(--panel)" }}>
      <div style={{ padding: "8px 10px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Projekt</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>LostTrack</div>
      </div>

      <nav style={{ display: "grid", gap: 8 }}>
        <NavLink to="/" style={linkStyle} end>Übersicht</NavLink>
        <NavLink to="/neu" style={linkStyle}>Neue Fundsache</NavLink>
        <NavLink to="/suche" style={linkStyle}>Suche</NavLink>
        <NavLink to="/einstellungen" style={linkStyle}>Einstellungen</NavLink>
      </nav>

      <div style={{ marginTop: 18, fontSize: 12, color: "var(--muted)" }}>
        Schritt 3: Grundgerüst
      </div>
    </aside>
  );
}
