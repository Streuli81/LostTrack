// C:\Dev\LostTrack\losttrack-web\src\main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.jsx";
import "./styles/base.css";

import { DevTimeTracker } from "./tools/devTimeTracker";

// Tracking beim App-Start initialisieren (vor render!)
DevTimeTracker.start({
  project: "LostTrack",
  endpoint: "http://localhost:4317/track",

  // Für die BlueShift-ähnliche Excel-Struktur (Projektplan: Phase/Aufgabe/Beschreibung)
  phase: "LostTrack – Allgemein",
  task: "Programmierung",
  description: "LostTrack Auto-Tracker",

  // Optional: wird im Logger als Meta geführt (falls du es in excelWriter.js nutzen willst)
  note: "App Start",

  // Sinnvoll: erlaubt dir Auswertung nach Screen/Route, wenn du note/description so verwenden willst
  noteProvider: () => window.location.pathname,
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
