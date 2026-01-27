// C:\Dev\LostTrack\losttrack-web\src\main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.jsx";
import "./styles/base.css";

// Zeitmessung erfolgt ausschliesslich über VS Code (start-losttrack.ps1)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
