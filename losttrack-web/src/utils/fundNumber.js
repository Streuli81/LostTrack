function pad5(n) {
  return String(n).padStart(5, "0");
}

/**
 * Vorschau-Fundnummer (ohne Counter zu erhöhen).
 * Zeigt, welche Nummer als nächstes vergeben würde.
 */
export function previewNextFundNumber() {
  const year = new Date().getFullYear();
  const storageKey = `losttrack_fundcounter_${year}`;

  const lastValue = localStorage.getItem(storageKey);
  const lastNumber = lastValue ? parseInt(lastValue, 10) : 0;

  const nextNumber = lastNumber + 1;
  return `${year}-${pad5(nextNumber)}`;
}

/**
 * Vergibt die Fundnummer verbindlich (erhöht Counter).
 * Diese Funktion nur beim Speichern verwenden.
 */
export function commitNextFundNumber() {
  const year = new Date().getFullYear();
  const storageKey = `losttrack_fundcounter_${year}`;

  const lastValue = localStorage.getItem(storageKey);
  const lastNumber = lastValue ? parseInt(lastValue, 10) : 0;

  const nextNumber = lastNumber + 1;
  localStorage.setItem(storageKey, String(nextNumber));

  return `${year}-${pad5(nextNumber)}`;
}
