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

// The offline-shell service worker was retired after it kept serving a
// stale cached app shell across deploys on some mobile browsers (a stale
// content-hashed JS/CSS filename is a 404, so the app failed to load
// entirely). Actively unregister anything left over from earlier visits.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}
