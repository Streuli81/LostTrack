// src/storage/drafts.js
//
// Draft-Storage (lokal im Browser) via localStorage.
// Ziel: Entwürfe speichern, auflisten, laden, löschen.
// Später kann man das problemlos auf IndexedDB oder Backend umstellen.

const STORAGE_KEY = "losttrack:drafts:v1";

/**
 * Kleine Hilfsfunktion: UUID ohne externe Library.
 * (Kollisionsrisiko in Praxis sehr gering für diesen Use-Case.)
 */
function makeId() {
  // Beispiel: "dft_1700000000000_ab12cd34"
  const rand = Math.random().toString(16).slice(2, 10);
  return `dft_${Date.now()}_${rand}`;
}

function nowIso() {
  return new Date().toISOString();
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // Wenn JSON korrupt ist, nicht crashen
    console.error("Drafts read error:", e);
    return [];
  }
}

function writeAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * Speichert oder aktualisiert einen Draft.
 *
 * Erwartung: draft ist ein Objekt, z.B.
 * {
 *   id?: string,
 *   status?: "draft",
 *   data: {... beliebige Erfassungsdaten ...}
 * }
 *
 * Rückgabe: gespeicherter Draft (mit id, createdAt/updatedAt)
 */
export function saveDraft(draft) {
  if (!draft || typeof draft !== "object") {
    throw new Error("saveDraft: draft muss ein Objekt sein.");
  }

  const all = readAll();
  const incomingId = draft.id ? String(draft.id) : null;

  if (!incomingId) {
    // Neu anlegen
    const created = {
      ...draft,
      id: makeId(),
      status: draft.status ?? "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const next = [created, ...all];
    writeAll(next);
    return created;
  }

  // Update bestehend
  const idx = all.findIndex((d) => String(d.id) === incomingId);

  if (idx === -1) {
    // Falls id existiert, aber nicht gefunden → als neu behandeln (robust)
    const created = {
      ...draft,
      id: incomingId,
      status: draft.status ?? "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const next = [created, ...all];
    writeAll(next);
    return created;
  }

  const updated = {
    ...all[idx],
    ...draft,
    id: incomingId,
    status: draft.status ?? all[idx].status ?? "draft",
    createdAt: all[idx].createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  const next = [...all];
  next[idx] = updated;
  writeAll(next);
  return updated;
}

/**
 * Liefert alle Drafts (neueste zuerst).
 */
export function listDrafts() {
  const all = readAll();
  return all.sort((a, b) => {
    const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return tb - ta;
  });
}

/**
 * Liefert einen Draft anhand der id oder null.
 */
export function getDraft(id) {
  if (!id) return null;
  const all = readAll();
  return all.find((d) => String(d.id) === String(id)) ?? null;
}

/**
 * Löscht einen Draft anhand der id.
 * Rückgabe: true wenn gelöscht, sonst false
 */
export function deleteDraft(id) {
  if (!id) return false;
  const all = readAll();
  const next = all.filter((d) => String(d.id) !== String(id));
  const changed = next.length !== all.length;
  if (changed) writeAll(next);
  return changed;
}

/**
 * Hilfsfunktion für Entwicklung: setzt alle Drafts zurück.
 * (Nicht zwingend im UI verwenden, eher für Tests.)
 */
export function clearDrafts() {
  writeAll([]);
}
