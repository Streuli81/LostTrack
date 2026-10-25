// src/core/auth/permissions.js

// Gemeinsame Rechte für Navigation, Seiten und Speicherfunktionen.
const ROLE_PERMISSIONS = {
  ADMIN: ["ITEM_VIEW", "ITEM_CREATE", "ITEM_EDIT", "RECEIPT_PRINT", "CASHBOOK_VIEW", "CASHBOOK_POST", "USER_MANAGE"],
  EDITOR: ["ITEM_VIEW", "ITEM_CREATE", "ITEM_EDIT", "RECEIPT_PRINT", "CASHBOOK_VIEW", "CASHBOOK_POST"],
  VIEWER: ["ITEM_VIEW", "CASHBOOK_VIEW"],
};

export function can(user, action) {
  if (!user || user.active === false || user.disabled === true) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(action) === true;
}
