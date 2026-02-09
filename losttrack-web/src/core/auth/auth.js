// src/core/auth/auth.js
import { storage } from "../storage/storage.js";

const STORAGE_VERSION = "v1";
const KEY_USERS = `lostItems.users.${STORAGE_VERSION}`;
const KEY_SESSION = `lostItems.session.${STORAGE_VERSION}`;

const ROLE_PERMS = {
  ADMIN: ["*"],
  USER: ["ITEM_CREATE", "ITEM_EDIT"],
};

function fnv1a32Hex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

function seedIfEmpty() {
  const users = storage.getJson(KEY_USERS, []);
  if (Array.isArray(users) && users.length) return;

  const now = new Date().toISOString();
  storage.setJson(KEY_USERS, [
    {
      id: "u_admin",
      username: "admin",
      displayName: "Admin",
      role: "ADMIN",
      passwordHash: fnv1a32Hex("admin"),
      createdAt: now,
      disabled: false,
    },
  ]);
}

function stripSensitive(u) {
  if (!u) return u;
  const { passwordHash, ...rest } = u;
  return rest;
}

function getUsersRaw() {
  seedIfEmpty();
  const users = storage.getJson(KEY_USERS, []);
  return Array.isArray(users) ? users : [];
}

export function listUsers() {
  return getUsersRaw().map(stripSensitive);
}

export function isLoggedIn() {
  const s = storage.getJson(KEY_SESSION, null);
  return !!(s && s.userId);
}

export function getSession() {
  const s = storage.getJson(KEY_SESSION, null);
  if (!s || typeof s !== "object") return null;
  if (!s.userId) return null;
  return s;
}

export function getCurrentUser() {
  const sess = getSession();
  if (!sess) return null;

  const users = getUsersRaw();
  const u = users.find((x) => x?.id === sess.userId) || null;
  if (!u || u.disabled) return null;

  return stripSensitive(u);
}

export function getCurrentUserName() {
  const u = getCurrentUser();
  return (u?.displayName || u?.username || "").toString().trim() || null;
}

export function hasPermission(action) {
  const u = getCurrentUser();
  if (!u) return false;
  const role = String(u.role || "USER").toUpperCase();
  const perms = ROLE_PERMS[role] || [];
  if (perms.includes("*")) return true;
  return perms.includes(action);
}

export function login({ username, password }) {
  seedIfEmpty();

  const un = (username ?? "").toString().trim();
  const pw = (password ?? "").toString();

  if (!un || !pw) return { ok: false, error: "Bitte Benutzername und Passwort eingeben." };

  const users = getUsersRaw();
  const u = users.find((x) => (x?.username || "").toString().trim() === un) || null;

  if (!u) return { ok: false, error: "Login fehlgeschlagen." };
  if (u.disabled) return { ok: false, error: "Benutzer ist deaktiviert." };

  if ((u.passwordHash || "") !== fnv1a32Hex(pw)) return { ok: false, error: "Login fehlgeschlagen." };

  storage.setJson(KEY_SESSION, { userId: u.id, at: new Date().toISOString() });
  return { ok: true, user: stripSensitive(u) };
}

export function logout() {
  storage.setJson(KEY_SESSION, null);
}
