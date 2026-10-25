import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createUser, listUsers, updateUser, deleteUser, getCurrentUser } from "../src/core/storage/userRepo.js";
import { login, logout, isLoggedIn, hasPermission, getCurrentUserName } from "../src/core/auth/auth.js";

// Nur flüchtiger Testspeicher: keine echten Browser- oder Geschäftsdaten.
beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
});
const signInAdmin = () => assert.equal(login({ username: "admin", password: "admin" }).ok, true);
const input = (extra = {}) => ({ name: "Muster", username: "muster", password: "Test-Passwort", role: "EDITOR", active: true, ...extra });

test("Erster Start meldet niemanden automatisch an; Standardadmin funktioniert", () => {
  assert.equal(isLoggedIn(), false);
  assert.equal(listUsers().length, 1);
  signInAdmin();
  assert.equal(getCurrentUserName(), "Admin");
  assert.equal(hasPermission("USER_MANAGE"), true);
  assert.equal("passwordHash" in getCurrentUser(), false);
  logout();
  assert.equal(getCurrentUser(), null);
});

test("Angelegter Benutzer kann sich anmelden; falsches Passwort wird abgewiesen", () => {
  signInAdmin();
  const created = createUser(input());
  assert.equal(created.ok, true);
  assert.equal("passwordHash" in created.value, false);
  logout();
  assert.equal(login({ username: "muster", password: "falsch" }).ok, false);
  assert.equal(isLoggedIn(), false);
  assert.equal(login({ username: "MUSTER", password: "Test-Passwort" }).ok, true);
  assert.equal(getCurrentUser().id, created.value.id);
  assert.equal(hasPermission("ITEM_EDIT"), true);
  assert.equal(hasPermission("USER_MANAGE"), false);
});

test("Deaktivierung beendet die Gültigkeit einer vorhandenen Sitzung", () => {
  signInAdmin();
  const user = createUser(input()).value;
  assert.equal(updateUser(user.id, { active: false }).ok, true);
  logout();
  assert.equal(login({ username: "muster", password: "Test-Passwort" }).ok, false);
  // Andere bereits geöffnete Sitzung desselben Benutzers simulieren.
  localStorage.setItem("losttrack:lostItems.session.v1", JSON.stringify({ userId: user.id }));
  assert.equal(isLoggedIn(), false);
  assert.equal(hasPermission("ITEM_EDIT"), false);
  signInAdmin();
  assert.equal(updateUser(user.id, { active: true }).ok, true);
  logout();
  assert.equal(login({ username: "muster", password: "Test-Passwort" }).ok, true);
});

test("Passwortänderung ersetzt das alte Passwort", () => {
  signInAdmin();
  const user = createUser(input()).value;
  assert.equal(updateUser(user.id, { password: "Neues-Passwort" }).ok, true);
  logout();
  assert.equal(login({ username: "muster", password: "Test-Passwort" }).ok, false);
  assert.equal(login({ username: "muster", password: "Neues-Passwort" }).ok, true);
});

test("Benutzerverwaltung verlangt einen angemeldeten Admin", () => {
  assert.equal(createUser(input()).ok, false);
  signInAdmin();
  const user = createUser(input({ role: "VIEWER" })).value;
  logout();
  login({ username: "muster", password: "Test-Passwort" });
  assert.equal(createUser(input({ username: "anderer" })).ok, false);
  assert.equal(updateUser(user.id, { role: "ADMIN" }).ok, false);
  assert.equal(deleteUser("u_admin").ok, false);
});

test("Leere Pflichtangaben und doppelte Benutzernamen werden abgewiesen", () => {
  signInAdmin();
  for (const extra of [{ name: " " }, { username: " " }, { password: " " }, { role: "UNBEKANNT" }]) {
    assert.equal(createUser(input(extra)).ok, false);
  }
  assert.equal(createUser(input()).ok, true);
  assert.equal(createUser(input({ username: "MUSTER" })).ok, false);
  assert.equal(updateUser("u_admin", { username: "muster" }).ok, false);
  assert.equal(updateUser("u_admin", { password: " " }).ok, false);
});

test("Letzter verwendbarer Admin bleibt erhalten; inaktive Admins zählen nicht", () => {
  signInAdmin();
  createUser(input({ role: "ADMIN", active: false }));
  assert.equal(updateUser("u_admin", { active: false }).ok, false);
  assert.equal(updateUser("u_admin", { role: "VIEWER" }).ok, false);
  assert.equal(deleteUser("u_admin").ok, false);
  assert.equal(isLoggedIn(), true);
});

test("Gelöschte Benutzer verlieren ihre Anmeldung ohne Ersatzbenutzer", () => {
  signInAdmin();
  const user = createUser(input()).value;
  assert.equal(deleteUser(user.id).ok, true);
  localStorage.setItem("losttrack:lostItems.session.v1", JSON.stringify({ userId: user.id }));
  assert.equal(isLoggedIn(), false);
  assert.equal(getCurrentUser(), null);
});

test("Übernahme bewahrt alte Anmeldekonten, Passwörter, Rollen und Sitzung", () => {
  // Hash im bisherigen Format aus einem frisch angelegten Konto gewinnen.
  signInAdmin();
  const seeded = JSON.parse(localStorage.getItem("losttrack:lostItems.users.v2"));
  const old = [{ ...seeded[0], displayName: "Bisheriger Admin", disabled: false },
    { ...seeded[0], id: "disabled", username: "gesperrt", disabled: true }];
  localStorage.setItem("losttrack:lostItems.users.v2", "null");
  localStorage.setItem("losttrack:lostItems.users.v1", JSON.stringify(old));
  localStorage.setItem("losttrack:lostItems.records.v1", "unveränderte Fundsachen");
  assert.equal(getCurrentUserName(), "Bisheriger Admin");
  assert.equal(listUsers().length, 2);
  logout();
  signInAdmin();
  assert.equal(login({ username: "gesperrt", password: "admin" }).ok, false);
  assert.equal(localStorage.getItem("losttrack:lostItems.users.v1"), JSON.stringify(old));
  assert.equal(localStorage.getItem("losttrack:lostItems.records.v1"), "unveränderte Fundsachen");
});

test("Alte Verwaltungskonten bleiben erhalten; Kollisionen werden getrennt übernommen", () => {
  const legacy = [{ id: "u_admin", name: "Alter Admin", username: "admin", role: "ADMIN", active: true },
    { id: "alt", name: "Alte Leserin", username: "leserin", role: "VIEWER", active: false }];
  localStorage.setItem("losttrack_users_v1", JSON.stringify(legacy));
  localStorage.setItem("losttrack_current_user_v1", "alt");
  const users = listUsers();
  assert.equal(users.length, 3);
  assert.equal(new Set(users.map((u) => u.id)).size, 3);
  const imported = users.find((u) => u.name === "Alter Admin");
  assert.equal(imported.username, "admin-alt1");
  assert.equal(imported.needsPassword, true);
  assert.equal(users.find((u) => u.id === "alt").active, false);
  assert.equal(isLoggedIn(), false);
  assert.equal(login({ username: "admin-alt1", password: "admin" }).ok, false);
  signInAdmin();
  assert.equal(updateUser(imported.id, { password: "Eigenes-Passwort" }).ok, true);
  logout();
  assert.equal(login({ username: "admin-alt1", password: "Eigenes-Passwort" }).ok, true);
  assert.equal(localStorage.getItem("losttrack_users_v1"), JSON.stringify(legacy));
  assert.equal(listUsers().length, 3);
});

test("Übernommene und später gelöschte Konten werden nicht erneut importiert", () => {
  localStorage.setItem("losttrack_users_v1", JSON.stringify([
    { id: "alt", name: "Alt", username: "alt", role: "VIEWER", active: true },
  ]));
  signInAdmin();
  assert.equal(deleteUser("alt").ok, true);
  assert.equal(listUsers().some((u) => u.id === "alt"), false);
});

test("Änderungen von Name, Benutzername und Rolle gelten auch für die Anmeldung", () => {
  signInAdmin();
  const user = createUser(input()).value;
  assert.equal(updateUser(user.id, { name: "Neuer Name", username: "neu", role: "VIEWER" }).ok, true);
  logout();
  assert.equal(login({ username: "muster", password: "Test-Passwort" }).ok, false);
  assert.equal(login({ username: "neu", password: "Test-Passwort" }).ok, true);
  assert.equal(getCurrentUserName(), "Neuer Name");
  assert.equal(hasPermission("ITEM_EDIT"), false);
  assert.equal(listUsers().find((u) => u.id === user.id).role, "VIEWER");
});

test("Ein zweiter verwendbarer Admin erlaubt Deaktivierung und Reaktivierung des ersten", () => {
  signInAdmin();
  createUser(input({ role: "ADMIN" }));
  assert.equal(updateUser("u_admin", { active: false }).ok, true);
  assert.equal(isLoggedIn(), false);
  assert.equal(getCurrentUser(), null);
  assert.equal(login({ username: "muster", password: "Test-Passwort" }).ok, true);
  assert.equal(updateUser("u_admin", { active: true }).ok, true);
  logout();
  signInAdmin();
});
