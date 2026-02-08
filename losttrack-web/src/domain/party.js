// src/domain/party.js

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

/**
 * Normalisiert eine Personen-/Parteidaten-Struktur (Finder/Owner/Collector).
 * Zielshape:
 * {
 *   lastName, firstName, zip, city, street, streetNo, phone, email
 * }
 *
 * Backward-compatible:
 * - akzeptiert alte Felder wie name, address, plz/ort/strasse/nummer etc.
 * - versucht address grob in street/streetNo + zip/city zu zerlegen (best effort)
 */
export function normalizeParty(input) {
  const p = input && typeof input === "object" ? input : {};

  // Neue Felder (bevorzugt)
  let lastName = safeStr(p.lastName || p.name || p.nachname);
  let firstName = safeStr(p.firstName || p.vorname);

  let zip = safeStr(p.zip || p.plz || p.postalCode);
  let city = safeStr(p.city || p.ort || p.town);

  let street = safeStr(p.street || p.strasse || p.streetName);
  let streetNo = safeStr(p.streetNo || p.nr || p.nummer || p.houseNumber);

  let phone = safeStr(p.phone || p.telefon || p.tel || p.mobile);
  let email = safeStr(p.email || p.eMail || p["e-mail"]);

  // Alte Kombi-Adresse ggf. “best effort” aufsplitten
  const address = safeStr(p.address);
  if (address && (!street || !zip || !city)) {
    // Beispiele:
    // "Musterstrasse 12, 8000 Zürich"
    // "Musterstrasse 12 8000 Zürich"
    // "8000 Zürich, Musterstrasse 12"
    const a = address.replace(/\s+/g, " ").trim();

    // Try: "... , 8000 City"
    let m = a.match(/^(.*?)[,\s]+(\d{4,5})\s+(.+)$/);
    if (m) {
      const left = safeStr(m[1]);
      const z = safeStr(m[2]);
      const c = safeStr(m[3]);

      if (!zip) zip = z;
      if (!city) city = c;

      if (!street && left) {
        // split street + no if possible
        const m2 = left.match(/^(.+?)\s+(\d+\w*)$/);
        if (m2) {
          if (!street) street = safeStr(m2[1]);
          if (!streetNo) streetNo = safeStr(m2[2]);
        } else {
          street = left;
        }
      }
    } else if (!street) {
      // fallback: alles als street
      street = a;
    }
  }

  // Falls jemand früher nur "fullName" hatte
  const fullName = safeStr(p.fullName);
  if (fullName && (!firstName && !lastName)) {
    // simple split: letzter Token = Nachname (best effort)
    const parts = fullName.split(" ").filter(Boolean);
    if (parts.length === 1) {
      lastName = parts[0];
    } else if (parts.length > 1) {
      lastName = parts.pop();
      firstName = parts.join(" ");
    }
  }

  return {
    lastName,
    firstName,
    zip,
    city,
    street,
    streetNo,
    phone,
    email,
  };
}

/**
 * Optional: fürs Anzeigen (keine Pflicht, aber praktisch)
 */
export function formatPartyShort(party) {
  const p = normalizeParty(party);
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  const addr1 = [p.street, p.streetNo].filter(Boolean).join(" ").trim();
  const addr2 = [p.zip, p.city].filter(Boolean).join(" ").trim();

  return [name, addr1, addr2].filter(Boolean).join(" • ");
}
