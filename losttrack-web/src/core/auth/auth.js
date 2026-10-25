import { storage } from "../storage/storage.js";
import { authenticateUser, getCurrentUser } from "../storage/userRepo.js";
export { getCurrentUser, listUsers } from "../storage/userRepo.js";
const KEY_SESSION = "lostItems.session.v1";
const ROLE_PERMS = {
  ADMIN: ["*"],
  EDITOR: ["ITEM_CREATE", "ITEM_EDIT", "RECEIPT_PRINT", "CASHBOOK_VIEW", "CASHBOOK_POST"],
  VIEWER: ["ITEM_VIEW", "CASHBOOK_VIEW"],
};
export function isLoggedIn() { return !!getCurrentUser(); }
export function getSession() { return isLoggedIn() ? storage.getJson(KEY_SESSION, null) : null; }
export function getCurrentUserName() { return getCurrentUser()?.name || null; }
export function hasPermission(action) {
  const user = getCurrentUser();
  if (!user) return false;
  const perms = ROLE_PERMS[user.role] || [];
  return perms.includes("*") || action === "ITEM_VIEW" || perms.includes(action);
}
export function login({ username, password }) {
  const un = String(username ?? "").trim();
  const pw = String(password ?? "");
  if (!un || !pw) return { ok: false, error: "Bitte Benutzername und Passwort eingeben." };
  return authenticateUser(un, pw);
}
export function logout() { storage.setJson(KEY_SESSION, null); }
