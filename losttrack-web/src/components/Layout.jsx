import { Outlet } from "react-router-dom";
import SideNav from "./SideNav.jsx";
import TopBar from "./TopBar.jsx";

export default function Layout() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "100%" }}>
      <SideNav />
      <div style={{ display: "grid", gridTemplateRows: "56px 1fr", height: "100%" }}>
        <TopBar />
        <main style={{ padding: 16 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
