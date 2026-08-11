import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, getStoredTheme } from "./theme";
import "./index.css";

applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline shell is a progressive enhancement; ignore registration failures.
    });
  });
}
