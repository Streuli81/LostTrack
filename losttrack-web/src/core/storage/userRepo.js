// src/core/storage/userRepo.js

const KEY_USERS = "losttrack_users_v1";
const KEY_CURRENT = "losttrack_current_user_v1";

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  // simpel, reicht für LocalStorage
  return "u_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function readUsersUnsafe() {
  try {
    const raw = localStorage.getItem(KEY_USERS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
}

function ensureSeed() {
  const users = readUsersUnsafe();
  if (users.length > 0) return;

  const admin = {
    id: uid(),
    name: "Admin",
    username: "admin",
    role: "ADMIN",
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  writeUsers([admin]);
  localStorage.setItem(KEY_CURRENT, admin.id);
}

export function listUsers() {
  ensureSeed();
  return readUsersUnsafe().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export function getUserById(id) {
  ensureSeed();
  return readUsersUnsafe().find((u) => u.id === id) || null;
}

export function getCurrentUserId() {
  ensureSeed();
  return localStorage.getItem(KEY_CURRENT) || null;
}

export function setCurrentUserId(id) {
  ensureSeed();
  localStorage.setItem(KEY_CURRENT, String(id));
}

export function getCurrentUser() {
  ensureSeed();
  const id = getCurrentUserId();
  const u = id ? getUserById(id) : null;
  // falls current gelöscht/ungültig -> fallback auf ersten aktiven
  if (u && u.active) return u;

  const users = readUsersUnsafe();
  const firstActive = users.find((x) => x.active);
  if (firstActive) {
    setCurrentUserId(firstActive.id);
    return firstActive;
  }
  return users[0] || null;
}

export function createUser(input) {
  ensureSeed();
  const users = readUsersUnsafe();

  const name = String(input?.name || "").trim();
  const username = String(input?.username || "").trim();
  const role = String(input?.role || "EDITOR").trim();
  const active = !!input?.active;

  if (!name) return { ok: false, error: "Name ist Pflicht." };
  if (!username) return { ok: false, error: "Benutzername ist Pflicht." };

  const exists = users.some(
    (u) => String(u.username || "").toLowerCase() === username.toLowerCase()
  );
  if (exists) return { ok: false, error: "Benutzername existiert bereits." };

  const u = {
    id: uid(),
    name,
    username,
    role: ["ADMIN", "EDITOR", "VIEWER"].includes(role) ? role : "EDITOR",
    active,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  users.push(u);
  writeUsers(users);
  return { ok: true, value: u };
}

export function updateUser(id, patch) {
  ensureSeed();
  const users = readUsersUnsafe();
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) return { ok: false, error: "Benutzer nicht gefunden." };

  const prev = users[i];

  // username uniqueness
  if (patch?.username !== undefined) {
    const username = String(patch.username || "").trim();
    if (!username) return { ok: false, error: "Benutzername darf nicht leer sein." };
    const exists = users.some(
      (u) =>
        u.id !== id &&
        String(u.username || "").toLowerCase() === username.toLowerCase()
    );
    if (exists) return { ok: false, error: "Benutzername existiert bereits." };
  }

  const next = {
    ...prev,
    ...patch,
    updatedAt: nowIso(),
  };

  // Role safeguard: mindestens 1 Admin behalten
  if (prev.role === "ADMIN" && next.role !== "ADMIN") {
    const adminCount = users.filter((u) => u.role === "ADMIN").length;
    if (adminCount <= 1) {
      return { ok: false, error: "Mindestens 1 ADMIN muss bleiben." };
    }
  }

  users[i] = next;
  writeUsers(users);
  return { ok: true, value: next };
}

export function deleteUser(id) {
  ensureSeed();
  const users = readUsersUnsafe();
  const u = users.find((x) => x.id === id);
  if (!u) return { ok: false, error: "Benutzer nicht gefunden." };

  // Admin safeguard: mindestens 1 Admin behalten
  if (u.role === "ADMIN") {
    const adminCount = users.filter((x) => x.role === "ADMIN").length;
    if (adminCount <= 1) return { ok: false, error: "Letzten ADMIN darfst du nicht löschen." };
  }

  const next = users.filter((x) => x.id !== id);
  writeUsers(next);

  // falls current gelöscht -> fallback
  const cur = getCurrentUserId();
  if (cur === id) {
    const firstActive = next.find((x) => x.active) || next[0] || null;
    if (firstActive) setCurrentUserId(firstActive.id);
  }

  return { ok: true };
}
