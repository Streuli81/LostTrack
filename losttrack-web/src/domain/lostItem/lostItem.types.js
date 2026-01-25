// C:\Dev\LostTrack\losttrack-web\src\domain\lostItem\lostItem.types.js

/**
 * LostTrack Domain Model (JSDoc Types)
 * Hinweis: Wir bleiben bei .js. Die Typisierung erfolgt über JSDoc.
 */

/**
 * @typedef {Object} Finder
 * @property {string} name
 * @property {string} address
 * @property {string} phone
 * @property {string} email
 * @property {boolean} wantsReward
 */

/**
 * @typedef {Object} LostItemDetails
 * @property {string} categoryId      // aus Auswahlliste (Stammdaten) – optional
 * @property {string} categoryLabel   // Snapshot-Text (z.B. "Portemonnaie") – optional
 * @property {string} manualLabel     // Freitext, falls nicht in Liste – optional
 * @property {string} brand
 * @property {string} model
 * @property {string} color
 * @property {string} serialNumber
 * @property {string} description
 * @property {string} condition       // z.B. "neu", "gebraucht", "beschädigt" – optional
 */

/**
 * @typedef {Object} LostItemMeta
 * @property {string} createdAt       // ISO
 * @property {string} createdByUserId // Sachbearbeiter-ID
 * @property {string} createdByName   // Snapshot Name
 * @property {string} updatedAt       // ISO
 */

/**
 * @typedef {Object} LostItemLocation
 * @property {string} foundAtDate     // YYYY-MM-DD
 * @property {string} foundAtTime     // HH:mm
 * @property {string} place           // Freitext (Fundort)
 */

/**
 * @typedef {Object} LostItemPhoto
 * @property {string} id
 * @property {string} dataUrl         // Base64 DataURL (für MVP). Später: file/URL.
 * @property {string} createdAt       // ISO
 */

/**
 * @typedef {"open"|"in_review"|"released_to_owner"|"released_to_finder"|"disposed"|"archived"} LostItemStatus
 */

/**
 * @typedef {Object} LostItem
 * @property {string} id              // interne UUID
 * @property {string} caseNumber      // fortlaufende Fundnummer z.B. 2026-000123
 * @property {LostItemStatus} status
 * @property {Finder} finder
 * @property {LostItemDetails} details
 * @property {LostItemLocation} location
 * @property {LostItemPhoto[]} photos
 * @property {LostItemMeta} meta
 */

export {};
