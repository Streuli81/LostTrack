// src/domain/lostItem.js

/**
 * Domain Model: LostItem (Fundsache)
 * Hinweis: bewusst ohne UI-/Storage-Abhängigkeiten.
 */

function safeTrim(v) {
  return (v || "").toString().trim();
}

/**
 * Best-effort: alte address-Strings grob in Felder zerlegen.
 * Erwartete Muster (CH-typisch):
 * - "Musterstrasse 12, 8000 Zürich"
 * - "Musterstrasse 12 8000 Zürich"
 * - "8000 Zürich, Musterstrasse 12"
 */
function parseLegacyAddress(address) {
  const a = safeTrim(address);
  if (!a) return { street: "", streetNo: "", zip: "", city: "" };

  const compact = a.replace(/\s+/g, " ").trim();

  // Try: "... , 8000 City" oder "... 8000 City"
  let m = compact.match(/^(.*?)[,\s]+(\d{4,5})\s+(.+)$/);
  if (m) {
    const left = safeTrim(m[1]);
    const zip = safeTrim(m[2]);
    const city = safeTrim(m[3]);

    let street = left;
    let streetNo = "";

    // split street + number: "Musterstrasse 12a"
    const m2 = left.match(/^(.+?)\s+(\d+\w*)$/);
    if (m2) {
      street = safeTrim(m2[1]);
      streetNo = safeTrim(m2[2]);
    }

    return { street, streetNo, zip, city };
  }

  // Fallback: alles als street
  return { street: compact, streetNo: "", zip: "", city: "" };
}

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

    // ✅ Detaillierte Personenerfassung (statt name/address)
    finder: {
      lastName: "",
      firstName: "",
      zip: "",
      city: "",
      street: "",
      streetNo: "",
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

  // --- Sicherstellen, dass Unterobjekte existieren (robust, ohne Logikänderung)
  item.caseWorker = item.caseWorker || { id: "", name: "" };
  item.foundAt = item.foundAt || { date: "", time: "", location: "" };
  item.finder = item.finder || {};
  item.item = item.item || {
    predefinedKey: "",
    manualLabel: "",
    category: "",
    brand: "",
    type: "",
    color: "",
    serialNumber: "",
    description: "",
    condition: "",
  };

  // trim strings
  item.caseWorker.id = safeTrim(item.caseWorker.id);
  item.caseWorker.name = safeTrim(item.caseWorker.name);

  item.foundAt.date = safeTrim(item.foundAt.date);
  item.foundAt.time = safeTrim(item.foundAt.time);
  item.foundAt.location = safeTrim(item.foundAt.location);

  // ✅ Backward-Compatibility: falls alte Felder existieren
  // (z.B. finder.name, finder.address aus bestehenden Datensätzen)
  if (typeof item.finder.name === "string" && !item.finder.lastName && !item.finder.firstName) {
    const full = safeTrim(item.finder.name);
    // best effort: letzter Teil = Nachname
    const parts = full.split(" ").filter(Boolean);
    if (parts.length === 1) {
      item.finder.lastName = parts[0];
      item.finder.firstName = "";
    } else if (parts.length > 1) {
      item.finder.lastName = parts.pop();
      item.finder.firstName = parts.join(" ");
    }
  }

  if (typeof item.finder.address === "string") {
    const parsed = parseLegacyAddress(item.finder.address);
    // nur füllen, wenn die neuen Felder leer sind
    if (!item.finder.street) item.finder.street = parsed.street;
    if (!item.finder.streetNo) item.finder.streetNo = parsed.streetNo;
    if (!item.finder.zip) item.finder.zip = parsed.zip;
    if (!item.finder.city) item.finder.city = parsed.city;
  }

  // ✅ Neue Finder-Felder trimmen
  item.finder.lastName = safeTrim(item.finder.lastName);
  item.finder.firstName = safeTrim(item.finder.firstName);
  item.finder.zip = safeTrim(item.finder.zip);
  item.finder.city = safeTrim(item.finder.city);
  item.finder.street = safeTrim(item.finder.street);
  item.finder.streetNo = safeTrim(item.finder.streetNo);
  item.finder.phone = safeTrim(item.finder.phone);
  item.finder.email = safeTrim(item.finder.email);

  // Legacy-Felder optional entfernen? -> NEIN, wir lassen sie unangetastet,
  // damit wirklich "alles andere bleibt wie es ist".

  item.item.predefinedKey = safeTrim(item.item.predefinedKey);
  item.item.manualLabel = safeTrim(item.item.manualLabel);
  item.item.category = safeTrim(item.item.category);
  item.item.brand = safeTrim(item.item.brand);
  item.item.type = safeTrim(item.item.type);
  item.item.color = safeTrim(item.item.color);
  item.item.serialNumber = safeTrim(item.item.serialNumber);
  item.item.description = safeTrim(item.item.description);
  item.item.condition = safeTrim(item.item.condition);

  item.notes = safeTrim(item.notes);

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
