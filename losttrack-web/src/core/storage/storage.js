// Web-Implementierung (später Mobile: AsyncStorage, gleiche Schnittstelle)
const KEY_PREFIX = "losttrack:";

export const storage = {
  getJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  setJson(key, value) {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
  },
};
