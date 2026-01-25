// C:\Dev\LostTrack\losttrack-web\src\tools\devTimeTracker.js

const CONFIG = {
  endpoint: "http://localhost:4317/track",
  project: "LostTrack",
  heartbeatMs: 60_000,        // alle 60s
  inactivityMs: 2 * 60_000,   // nach 2 Minuten ohne Aktivität keine Heartbeats mehr
};

let sessionId = null;
let heartbeatTimer = null;
let isStarted = false;

let lastActivityTs = Date.now();
let visibility = typeof document !== "undefined" ? document.visibilityState : "visible";

// Meta wird beim Start gesetzt und laufend aktualisiert.
// description = aktueller Screen (Route)
let meta = {
  phase: "LostTrack – Allgemein",
  task: "Programmierung",
  description: "",
  note: "",
  user: "",
  machine: "",
  branch: "",
  commit: "",
};

function makeSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return String(Math.random()).slice(2) + "-" + Date.now();
}

function normalizeString(v) {
  if (typeof v !== "string") return "";
  return v.trim();
}

function getCurrentScreen() {
  try {
    return normalizeString(window.location.pathname || "");
  } catch {
    return "";
  }
}

async function send(type, extra = {}) {
  try {
    const payload = {
      project: CONFIG.project,
      type,
      ts: Date.now(),
      sessionId,
      ...extra,
    };

    await fetch(CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: type === "stop",
    });
  } catch {
    // Tracking darf die App nicht stören
  }
}

function markActivity() {
  lastActivityTs = Date.now();
}

function shouldHeartbeatNow() {
  const now = Date.now();
  const inactiveTooLong = now - lastActivityTs > CONFIG.inactivityMs;
  const tabHidden = visibility === "hidden";
  return !inactiveTooLong && !tabHidden;
}

function addActivityListeners() {
  const events = ["keydown", "mousedown", "mousemove", "touchstart", "scroll"];
  events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));

  document.addEventListener("visibilitychange", () => {
    visibility = document.visibilityState;
    if (visibility === "visible") markActivity();
  });

  window.addEventListener("beforeunload", () => {
    if (!isStarted) return;
    // Beim Schliessen: Stop inkl. letzter Screen-Beschreibung
    send("stop", { ...meta });
  });
}

export const DevTimeTracker = {
  /**
   * Startet Tracking beim App-Start.
   * description = aktueller Screen (Route)
   */
  start(options = {}) {
    if (isStarted) return;

    CONFIG.endpoint = options.endpoint || CONFIG.endpoint;
    CONFIG.project = options.project || CONFIG.project;

    sessionId = makeSessionId();
    isStarted = true;

    // optionale Meta-Werte
    meta.user = normalizeString(options.user);
    meta.machine = normalizeString(options.machine);
    meta.branch = normalizeString(options.branch);
    meta.commit = normalizeString(options.commit);
    meta.note = normalizeString(options.note);

    // Initiale Beschreibung = aktueller Screen
    meta.description = getCurrentScreen() || "App Start";

    addActivityListeners();

    // Start-Event
    send("start", { ...meta });

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!isStarted) return;

      if (shouldHeartbeatNow()) {
        const screen = getCurrentScreen();
        if (screen) meta.description = screen;

        // Heartbeat inkl. aktualisierter Beschreibung (Screen)
        send("heartbeat", { ...meta });
      }
      // Keine Heartbeats → Logger auto-stop nach 10 Minuten
    }, CONFIG.heartbeatMs);
  },

  /**
   * Manuelles Stoppen (z.B. Button)
   */
  stop() {
    if (!isStarted) return;
    isStarted = false;

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    meta.description = getCurrentScreen() || meta.description;
    send("stop", { ...meta });
  },

  /**
   * Optional: Note setzen (z.B. Detail-Aktion innerhalb eines Screens)
   */
  setNote(note) {
    if (!isStarted) return;
    const n = normalizeString(note);
    if (n) meta.note = n;
    send("heartbeat", { ...meta });
  },
};
