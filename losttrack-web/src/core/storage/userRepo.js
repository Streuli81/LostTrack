import { storage } from "./storage.js";
const KEY = "lostItems.users.v2";
const SESSION = "lostItems.session.v1";
const ROLES = ["ADMIN", "EDITOR", "VIEWER"];

// Bestehendes lokales Passwortformat; kein Ersatz für Server-Authentifizierung.
function hash(password) {
  let h = 0x811c9dc5;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}
function write(users) { storage.setJson(KEY, users); }
function read() {
  const current = storage.getJson(KEY, null);
  if (Array.isArray(current)) return current;
  // Einmalige Übernahme; beide alten Bestände bleiben unverändert erhalten.
  const old = storage.getJson("lostItems.users.v1", []);
  const users = Array.isArray(old) ? old.map((u) => ({ ...u,
    name: u.displayName || u.username, active: !u.disabled })) : [];
  if (!users.length) users.push({ id: "u_admin", name: "Admin", username: "admin",
    role: "ADMIN", active: true, passwordHash: hash("admin"), createdAt: new Date().toISOString() });
  let legacy = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("losttrack_users_v1") || "[]");
    if (Array.isArray(parsed)) legacy = parsed;
  } catch { /* Ungültiger alter Bestand wird nicht überschrieben. */ }
  for (const u of legacy) {
    // Gleicher Benutzername beweist keine gleiche Identität: beide erhalten.
    const original = String(u.username || "benutzer").trim();
    let username = original;
    let n = 1;
    while (users.some((x) => x.username.toLowerCase() === username.toLowerCase())) username = `${original}-alt${n++}`;
    users.push({ ...u, id: users.some((x) => x.id === u.id) ? crypto.randomUUID() : u.id,
      username, name: u.name || original, active: u.active !== false,
      role: ROLES.includes(u.role) ? u.role : "VIEWER", passwordHash: null });
  }
  write(users);
  return users;
}
function publicUser(u) {
  if (!u) return null;
  const result = { ...u, displayName: u.name, disabled: !u.active, needsPassword: !u.passwordHash };
  delete result.passwordHash;
  return result;
}
export function listUsers() {
  return read().map(publicUser).sort((a, b) => a.name.localeCompare(b.name));
}
export function getCurrentUser() {
  const session = storage.getJson(SESSION, null);
  const u = read().find((x) => x.id === session?.userId);
  return u?.active ? publicUser(u) : null;
}
export function authenticateUser(username, password) {
  const u = read().find((x) => x.username.toLowerCase() === username.toLowerCase());
  if (!u?.active || !u.passwordHash || u.passwordHash !== hash(password)) {
    return { ok: false, error: "Login fehlgeschlagen. Zugangsdaten und Aktivierung prüfen." };
  }
  storage.setJson(SESSION, { userId: u.id, at: new Date().toISOString() });
  return { ok: true, user: publicUser(u) };
}
function allowed() { return getCurrentUser()?.role === "ADMIN"; }
function validate(u, users) {
  if (!u.name) return "Name ist Pflicht.";
  if (!u.username) return "Benutzername ist Pflicht.";
  if (!ROLES.includes(u.role)) return "Ungültige Rolle.";
  if (users.some((x) => x.id !== u.id && x.username.toLowerCase() === u.username.toLowerCase())) return "Benutzername existiert bereits.";
  return null;
}
export function createUser(input) {
  if (!allowed()) return { ok: false, error: "Keine Berechtigung zur Benutzerverwaltung." };
  const users = read();
  const u = { id: crypto.randomUUID(), name: String(input.name || "").trim(),
    username: String(input.username || "").trim(), role: input.role || "EDITOR",
    active: input.active !== false, createdAt: new Date().toISOString() };
  const error = validate(u, users);
  if (error) return { ok: false, error };
  if (!input.password?.trim()) return { ok: false, error: "Passwort ist Pflicht." };
  u.passwordHash = hash(input.password);
  write([...users, u]);
  return { ok: true, value: publicUser(u) };
}
export function updateUser(id, patch) {
  if (!allowed()) return { ok: false, error: "Keine Berechtigung zur Benutzerverwaltung." };
  const users = read();
  const index = users.findIndex((u) => u.id === id);
  if (index < 0) return { ok: false, error: "Benutzer nicht gefunden." };
  const prev = users[index];
  const next = { ...prev, updatedAt: new Date().toISOString() };
  for (const key of ["name", "username", "role"]) if (patch[key] !== undefined) next[key] = String(patch[key]).trim();
  if (patch.active !== undefined) next.active = !!patch.active;
  const error = validate(next, users);
  if (error) return { ok: false, error };
  if (prev.active && prev.role === "ADMIN" && (!next.active || next.role !== "ADMIN") &&
      !users.some((u) => u.id !== id && u.active && u.role === "ADMIN" && u.passwordHash)) {
    return { ok: false, error: "Mindestens ein aktiver ADMIN mit Passwort muss bleiben." };
  }
  if (patch.password !== undefined) {
    if (!patch.password.trim()) return { ok: false, error: "Passwort darf nicht leer sein." };
    next.passwordHash = hash(patch.password);
  }
  users[index] = next;
  write(users);
  return { ok: true, value: publicUser(next) };
}
export function deleteUser(id) {
  if (!allowed()) return { ok: false, error: "Keine Berechtigung zur Benutzerverwaltung." };
  const users = read();
  const u = users.find((x) => x.id === id);
  if (!u) return { ok: false, error: "Benutzer nicht gefunden." };
  if (id === getCurrentUser()?.id) return { ok: false, error: "Eigenes Konto kann nicht gelöscht werden." };
  if (u.active && u.role === "ADMIN" && !users.some((x) => x.id !== id && x.active && x.role === "ADMIN" && x.passwordHash)) {
    return { ok: false, error: "Letzter aktiver ADMIN darf nicht gelöscht werden." };
  }
  write(users.filter((x) => x.id !== id));
  return { ok: true };
}
