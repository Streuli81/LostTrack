// C:\Dev\LostTrack\losttrack-web\src\domain\lostItem\lostItem.defaults.js

/**
 * @returns {string} ISO Timestamp
 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * @returns {string} YYYY-MM-DD (lokal)
 */
export function todayLocalDate() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * @returns {string} HH:mm (lokal)
 */
export function nowLocalTime() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

/**
 * @returns {string} simple UUID (crypto wenn verfügbar)
 */
export function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback (MVP)
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

/**
 * Default-Objekt für neue Fundsache
 * @param {{ userId?: string, userName?: string }} [opts]
 */
export function createEmptyLostItem(opts = {}) {
  const createdAt = nowIso();
  const userId = opts.userId || "";
  const userName = opts.userName || "";

  return {
    id: createId(),
    caseNumber: "", // wird bei Speicherung gesetzt (Schritt C)
    status: "open",
    finder: {
      name: "",
      address: "",
      phone: "",
      email: "",
      wantsReward: false,
    },
    details: {
      categoryId: "",
      categoryLabel: "",
      manualLabel: "",
      brand: "",
      model: "",
      color: "",
      serialNumber: "",
      description: "",
      condition: "",
    },
    location: {
      foundAtDate: todayLocalDate(),
      foundAtTime: nowLocalTime(),
      place: "",
    },
    photos: [],
    meta: {
      createdAt,
      createdByUserId: userId,
      createdByName: userName,
      updatedAt: createdAt,
    },
  };
}
