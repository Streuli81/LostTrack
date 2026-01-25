export function required(value, fieldName) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return `${fieldName} ist erforderlich.`;
  }
  return null;
}
