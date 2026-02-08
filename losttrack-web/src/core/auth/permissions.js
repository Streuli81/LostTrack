// src/core/auth/permissions.js

/**
 * Aktionen:
 * - ITEM_CREATE: neue Fundsache erfassen
 * - ITEM_EDIT: bestehende bearbeiten (Status/Parteien/Details)
 * - USER_MANAGE: Benutzer verwalten
 */
export function can(user, action) {
  const role = user?.role || "VIEWER";
  const active = user?.active !== false;

  if (!active) return false;

  if (role === "ADMIN") return true;

  if (role === "EDITOR") {
    return action === "ITEM_CREATE" || action === "ITEM_EDIT";
  }

  // VIEWER
  return false;
}
