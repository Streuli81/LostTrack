// src/domain/lostItem.js

/**
 * Domain Model: LostItem (Fundsache)
 * Hinweis: bewusst ohne UI-/Storage-Abhängigkeiten.
 */

export function createEmptyLostItem() {
  const nowIso = new Date().toISOString();

  return {
    id: "",                 // interne UUID (optional), kann leer bleiben, wenn du nur fundNo nutzt
    fundNo: "",             // z.B. 2026-000123 (wird bei Save vergeben)
    createdAt: nowIso,      // automatisch
    updatedAt: nowIso,      // automatisch

    caseWorker: {
      id: "",               // z.B. "ms"
      name: "",             // z.B. "M. Streuli"
    },

    foundAt: {
      date: "",             // "YYYY-MM-DD"
      time: "",             // "HH:MM"
      location: "",         // Freitext
    },

    finder: {
      name: "",
      address: "",
      phone: "",
      email: "",
      rewardRequested: false,
    },

    item: {
      predefinedKey: "",    // Key aus Auswahlliste (z.B. "wallet"), leer wenn manuell
      manualLabel: "",      // Freitext, leer wenn vordefiniert
      category: "",         // optional: z.B. "Dokumente"
      brand: "",
      type: "",
      color: "",
      serialNumber: "",
      description: "",      // Merkmale/Aussehen/Details
      condition: "",        // z.B. "gut", "beschädigt"
    },

    photos: [],             // später: [{ id, name, dataUrl, createdAt }]
    investigationSteps: [], // später: [{ at, by, text }]
    notes: "",
    status: "OPEN",         // OPEN | RETURNED | DISPOSED | TRANSFERRED (erweiterbar)
  };
}

/**
 * Normalisiert / baut das Objekt vor dem Persistieren.
 */
export function normalizeLostItem(input) {
  const nowIso = new Date().toISOString();

  const item = structuredClone(input);

  if (!item.createdAt) item.createdAt = nowIso;
  item.updatedAt = nowIso;

  // trim strings
  item.caseWorker.id = (item.caseWorker.id || "").trim();
  item.caseWorker.name = (item.caseWorker.name || "").trim();

  item.foundAt.date = (item.foundAt.date || "").trim();
  item.foundAt.time = (item.foundAt.time || "").trim();
  item.foundAt.location = (item.foundAt.location || "").trim();

  item.finder.name = (item.finder.name || "").trim();
  item.finder.address = (item.finder.address || "").trim();
  item.finder.phone = (item.finder.phone || "").trim();
  item.finder.email = (item.finder.email || "").trim();

  item.item.predefinedKey = (item.item.predefinedKey || "").trim();
  item.item.manualLabel = (item.item.manualLabel || "").trim();
  item.item.category = (item.item.category || "").trim();
  item.item.brand = (item.item.brand || "").trim();
  item.item.type = (item.item.type || "").trim();
  item.item.color = (item.item.color || "").trim();
  item.item.serialNumber = (item.item.serialNumber || "").trim();
  item.item.description = (item.item.description || "").trim();
  item.item.condition = (item.item.condition || "").trim();

  item.notes = (item.notes || "").trim();

  // Status normalisieren
  const allowed = new Set(["OPEN", "RETURNED", "DISPOSED", "TRANSFERRED"]);
  if (!allowed.has(item.status)) item.status = "OPEN";

  // Sicherstellen, dass genau eines von predefined/manual gesetzt ist (wenn möglich)
  if (item.item.predefinedKey && item.item.manualLabel) {
    // Wenn beide gesetzt wurden, bevorzugen wir vordefiniert und leeren manual
    item.item.manualLabel = "";
  }

  return item;
}
