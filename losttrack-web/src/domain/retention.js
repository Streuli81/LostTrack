/**
 * Zeitpunkte nach Art. 721 und 722 ZGB für die Anwendung im öffentlichen Raum.
 * Die Anzeige weist nur auf eine rechtliche Prüfung hin; sie ordnet keine
 * Versteigerung, Verwertung oder Eigentumsübertragung an.
 */
export const RETENTION_RULES = {
  PUBLIC_GROUND_ZH: {
    auctionReviewMonths: 12,
    finderAcquisitionYears: 5,
    label: "ZGB_721_722_PUBLIC_GROUND",
  },
};

/** Berechnet beide Fristen ab ihren getrennt zu erfassenden gesetzlichen Ereignissen. */
export function calculateRetention(item) {
  const custodyStart = parseCivilDate(item?.retention?.custodyStartDate);
  const noticeStart = parseCivilDate(item?.retention?.noticeDate);
  const rule = RETENTION_RULES.PUBLIC_GROUND_ZH;

  return {
    ruleKey: "PUBLIC_GROUND_ZH",
    custodyStartDate: item?.retention?.custodyStartDate || "",
    auctionReviewDate: custodyStart
      ? civilDateToIso(addCalendarMonths(custodyStart, rule.auctionReviewMonths))
      : "",
    noticeDate: item?.retention?.noticeDate || "",
    noticeType: String(item?.retention?.noticeType || ""),
    finderAcquisitionReviewDate: noticeStart
      ? civilDateToIso(addCalendarMonths(noticeStart, rule.finderAcquisitionYears * 12))
      : "",
    // Alte Funddatum-basierte Werte löschen, damit sie nicht weiter als Fristen gelten.
    startDate: "",
    storageDeadline: "",
    ownershipDeadline: "",
  };
}

/** Status zur Einjahresgrenze nach Art. 721 ZGB; diese ist keine automatische Verwertungsfreigabe. */
export function getRetentionStatus(item, today = new Date()) {
  if (item?.retention?.completedAt) return "COMPLETED";

  const deadline = parseCivilDate(item?.retention?.auctionReviewDate);
  if (!deadline) return "REVIEW_REQUIRED";

  const currentDay = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
  const daysRemaining = Math.floor((civilDateToUtc(deadline) - civilDateToUtc(currentDay)) / DAY_MS);

  // Art. 721 verlangt für eine öffentliche Versteigerung weitere Voraussetzungen.
  if (daysRemaining < 0) return "REVIEW_REQUIRED";
  if (daysRemaining < 14) return "URGENT";
  if (daysRemaining < 60) return "WARNING";
  return "OK";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseCivilDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  let year;
  let month;
  let day;
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (match) {
    [, year, month, day] = match;
  } else {
    match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return null;
    [, day, month, year] = match;
  }

  const date = { year: Number(year), month: Number(month), day: Number(day) };
  if (date.year < 1 || date.month < 1 || date.month > 12 || date.day < 1 || date.day > 31) return null;

  const parsed = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (
    parsed.getUTCFullYear() !== date.year ||
    parsed.getUTCMonth() + 1 !== date.month ||
    parsed.getUTCDate() !== date.day
  ) return null;

  return date;
}

/** OR Art. 77: entsprechender Kalendertag, bei fehlendem Tag Monatsletzter. */
function addCalendarMonths(date, months) {
  const totalMonth = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(totalMonth / 12);
  const month = (totalMonth % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, day: Math.min(date.day, lastDay) };
}

function civilDateToUtc({ year, month, day }) {
  return Date.UTC(year, month - 1, day);
}

function civilDateToIso({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`;
}
