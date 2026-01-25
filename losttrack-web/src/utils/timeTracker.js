// utils/timeTracker.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

const STORAGE_KEY = "losttrack_time_tracking_v1";

/**
 * Datenmodell:
 * {
 *   totalMs: number,
 *   daily: { "YYYY-MM-DD": number },
 *   lastStartTs: number | null,
 *   lastState: "active" | "background" | "inactive" | null
 * }
 */

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function loadState() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      totalMs: 0,
      daily: {},
      lastStartTs: null,
      lastState: null,
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      totalMs: parsed.totalMs ?? 0,
      daily: parsed.daily ?? {},
      lastStartTs: parsed.lastStartTs ?? null,
      lastState: parsed.lastState ?? null,
    };
  } catch {
    return {
      totalMs: 0,
      daily: {},
      lastStartTs: null,
      lastState: null,
    };
  }
}

async function saveState(state) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Commit einer laufenden Session: Zeit seit lastStartTs wird verbucht.
 * Schutz: wenn lastStartTs null ist, passiert nichts.
 */
async function commitElapsedMs(nowTs = Date.now()) {
  const state = await loadState();
  if (!state.lastStartTs) return state;

  const elapsed = Math.max(0, nowTs - state.lastStartTs);
  const key = todayKey();

  state.totalMs += elapsed;
  state.daily[key] = (state.daily[key] ?? 0) + elapsed;

  state.lastStartTs = null;
  await saveState(state);
  return state;
}

/**
 * Start einer Session (nur wenn nicht bereits laufend)
 */
async function startSession(nowTs = Date.now()) {
  const state = await loadState();
  if (!state.lastStartTs) {
    state.lastStartTs = nowTs;
    await saveState(state);
  }
  return state;
}

/**
 * Public API
 */
export async function getTimeStats() {
  const state = await loadState();
  return {
    totalMs: state.totalMs,
    todayMs: state.daily[todayKey()] ?? 0,
    daily: state.daily,
    isRunning: Boolean(state.lastStartTs),
  };
}

export async function resetTimeStats() {
  const fresh = { totalMs: 0, daily: {}, lastStartTs: null, lastState: null };
  await saveState(fresh);
  return fresh;
}

/**
 * Tracker initialisieren:
 * - startet Session beim App-Start (active)
 * - stoppt & verbucht beim Backgrounding
 * - startet neu beim Foregrounding
 */
export function initTimeTracking() {
  let subscription = null;

  // Sofort starten (App läuft ja gerade)
  startSession().catch(() => {});

  subscription = AppState.addEventListener("change", async (nextState) => {
    const nowTs = Date.now();

    if (nextState === "active") {
      // Neue Session beginnen
      await startSession(nowTs);
    } else if (nextState === "background" || nextState === "inactive") {
      // Laufende Session verbuchen
      await commitElapsedMs(nowTs);
    }

    // lastState speichern (optional, hilft beim Debug)
    const state = await loadState();
    state.lastState = nextState;
    await saveState(state);
  });

  return () => {
    if (subscription) subscription.remove();
  };
}
