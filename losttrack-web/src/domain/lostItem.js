// src/domain/lostItem.js

/**
 * Domain Model: LostItem (Fundsache)
 * Hinweis: bewusst ohne UI-/Storage-Abhängigkeiten.
 *
 * Phase 1 (Fristen- & Aufbewahrungsmanagement, ZH öffentlicher Raum):
 * - retention: Fristenfelder (12 Monate Storage, 5 Jahre Ownership – informativ)
 * - flags: Klassifizierung (cash/highValue/requireDelictCheck)
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
    id: "", // interne UUID (optional), kann leer bleiben, wenn du nur fundNo nutzt
    fundNo: "", // z.B. 2026-000123 (wird bei Save vergeben)
    createdAt: nowIso, // automatisch
    updatedAt: nowIso, // automatisch

    caseWorker: {
      id: "", // z.B. "ms"
      name: "", // z.B. "M. Streuli"
    },

    foundAt: {
      date: "", // "YYYY-MM-DD"
      time: "", // "HH:MM"
      location: "", // Freitext
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
      rewardChoice: "", // "REQUESTED" | "WAIVED"; leer bei noch nicht getroffener Wahl
    },

    item: {
      predefinedKey: "", // Key aus Auswahlliste (z.B. "wallet"), leer wenn manuell
      manualLabel: "", // Freitext, leer wenn vordefiniert
      category: "", // optional: z.B. "Dokumente" oder "CASH"
      brand: "",
      type: "",
      color: "",
      serialNumber: "",
      description: "", // Merkmale/Aussehen/Details
      condition: "", // z.B. "gut", "beschädigt"

      // ✅ Phase 1: optionale Wertangabe (für High-Value / Cash-Workflow)
      // Falls du (noch) kein UI-Feld hast: bleibt einfach leer / 0.
      estimatedValueCHF: 0, // number
    },

    // ✅ Phase 1: Fristen-/Aufbewahrungsdaten (ZH öffentlicher Raum)
    retention: {
      ruleKey: "PUBLIC_GROUND_ZH", // aktuell fix für deinen Scope
      custodyStartDate: "", // Datum, ab dem Polizei/öffentliche Anstalt die Sache aufbewahrt (Art. 721 ZGB)
      auctionReviewDate: "", // custodyStartDate + 12 Kalendermonate; keine automatische Verwertungsfreigabe
      noticeDate: "", // Datum der Anzeige/Bekanntmachung gemäss Art. 722 ZGB
      noticeType: "", // "POLICE_REPORT" | "PUBLIC_ANNOUNCEMENT"
      finderAcquisitionReviewDate: "", // noticeDate + 5 Kalenderjahre; möglicher Erwerb der Finderperson
      startDate: "", // Legacy-Feld, wird nicht mehr für Fristen verwendet
      storageDeadline: "", // Legacy-Feld, wird nicht mehr für Fristen verwendet
      ownershipDeadline: "", // Legacy-Feld, wird nicht mehr für Fristen verwendet
      completedAt: "", // ISO, wenn verwertet/abgeschlossen
      dispositionType: null, // "AUCTION" | "SALE" | "RECYCLE" | "DESTROY" | "TRANSFER_TO_MUNICIPAL_ACCOUNT" | null
    },

    // ✅ Phase 1: Klassifizierungs-Flags
    flags: {
      highValue: false, // z.B. >= 5000 CHF
      cash: false, // Bargeld
      requireDelictCheck: false, // z.B. Bargeld > 5'000 oder highValue
    },

    photos: [], // später: [{ id, name, dataUrl, createdAt }]
    investigationSteps: [], // später: [{ at, by, text }]
    notes: "",
    status: "OPEN", // OPEN | RETURNED | DISPOSED | TRANSFERRED (erweiterbar)
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
    estimatedValueCHF: 0,
  };

  // ✅ Phase 1: retention / flags robust initialisieren (Backward compatible)
  item.retention = item.retention || {
    ruleKey: "PUBLIC_GROUND_ZH",
    custodyStartDate: "",
    auctionReviewDate: "",
    noticeDate: "",
    noticeType: "",
    finderAcquisitionReviewDate: "",
    startDate: "",
    storageDeadline: "",
    ownershipDeadline: "",
    completedAt: "",
    dispositionType: null,
  };

  item.flags = item.flags || {
    highValue: false,
    cash: false,
    requireDelictCheck: false,
  };

  // trim strings
  item.caseWorker.id = safeTrim(item.caseWorker.id);
  item.caseWorker.name = safeTrim(item.caseWorker.name);

  item.foundAt.date = safeTrim(item.foundAt.date);
  item.foundAt.time = safeTrim(item.foundAt.time);
  item.foundAt.location = safeTrim(item.foundAt.location);

  // ✅ Backward-Compatibility: falls alte Felder existieren
  // (z.B. finder.name, finder.address aus bestehenden Datensätzen)
  if (
    typeof item.finder.name === "string" &&
    !item.finder.lastName &&
    !item.finder.firstName
  ) {
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

  // ✅ Phase 1: estimatedValueCHF normalisieren (number)
  const v = item.item.estimatedValueCHF;
  if (typeof v === "string") {
    // erlaubt "10000" oder "10'000" oder "10 000"
    const cleaned = v.replace(/['\s]/g, "");
    const n = Number(cleaned);
    item.item.estimatedValueCHF = Number.isFinite(n) ? n : 0;
  } else if (typeof v === "number") {
    item.item.estimatedValueCHF = Number.isFinite(v) ? v : 0;
  } else {
    item.item.estimatedValueCHF = 0;
  }

  item.notes = safeTrim(item.notes);

  // ✅ Phase 1: retention-Felder trimmen/normalisieren
  item.retention.ruleKey = safeTrim(item.retention.ruleKey) || "PUBLIC_GROUND_ZH";
  item.retention.custodyStartDate = safeTrim(item.retention.custodyStartDate);
  item.retention.auctionReviewDate = safeTrim(item.retention.auctionReviewDate);
  item.retention.noticeDate = safeTrim(item.retention.noticeDate);
  item.retention.noticeType = safeTrim(item.retention.noticeType);
  item.retention.finderAcquisitionReviewDate = safeTrim(item.retention.finderAcquisitionReviewDate);
  item.retention.startDate = safeTrim(item.retention.startDate);
  item.retention.storageDeadline = safeTrim(item.retention.storageDeadline);
  item.retention.ownershipDeadline = safeTrim(item.retention.ownershipDeadline);
  item.retention.completedAt = safeTrim(item.retention.completedAt);

  // dispositionType bleibt bewusst "roh" (enum/String oder null)
  const disp = item.retention.dispositionType;
  if (disp !== null && disp !== undefined) {
    const s = safeTrim(disp);
    item.retention.dispositionType = s ? s : null;
  } else {
    item.retention.dispositionType = null;
  }

  // ✅ Phase 1: flags robust booleanisieren
  item.flags.highValue = !!item.flags.highValue;
  item.flags.cash = !!item.flags.cash;
  item.flags.requireDelictCheck = !!item.flags.requireDelictCheck;

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
