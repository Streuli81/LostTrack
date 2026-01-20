export default function TopBar() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      borderBottom: "1px solid var(--border)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.00))"
    }}>
      <div style={{ fontWeight: 700 }}>LostTrack</div>
      <div style={{ marginLeft: 12, color: "var(--muted)", fontSize: 13 }}>
        Fundsachenverwaltung – Web (PWA-ready)
      </div>
    </div>
  );
}
