import { storage } from "./storage.js";

const KEY = "lostItems";

export function listLostItems() {
  return storage.getJson(KEY, []);
}

export function addLostItem(item) {
  const all = listLostItems();
  all.unshift(item);
  storage.setJson(KEY, all);
  return item;
}
