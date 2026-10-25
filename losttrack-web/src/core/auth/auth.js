import { storage } from "../storage/storage.js";
import { authenticateUser, getCurrentUser } from "../storage/userRepo.js";
export { getCurrentUser, listUsers } from "../storage/userRepo.js";
import { can } from "./permissions.js";
const KEY_SESSION = "lostItems.session.v1";
export function isLoggedIn() { return !!getCurrentUser(); }
export function getSession() { return isLoggedIn() ? storage.getJson(KEY_SESSION, null) : null; }
export function getCurrentUserName() { return getCurrentUser()?.name || null; }
export function hasPermission(action) {
  return can(getCurrentUser(), action);
}
export function login({ username, password }) {
  const un = String(username ?? "").trim();
  const pw = String(password ?? "");
  if (!un || !pw) return { ok: false, error: "Bitte Benutzername und Passwort eingeben." };
  return authenticateUser(un, pw);
}
export function logout() { storage.setJson(KEY_SESSION, null); }
