// src/components/RequireAuth.jsx
import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "../core/auth/auth.js";

export default function RequireAuth({ children }) {
  const loc = useLocation();

  if (!isLoggedIn()) {
    const next = encodeURIComponent(loc.pathname + (loc.search || ""));
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}
