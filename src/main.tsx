import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

try {
  const stored = localStorage.getItem("theme-image");
  const shouldEnable = stored === null ? true : stored === "1";
  if (shouldEnable) {
    document.body.classList.add("theme-image");
    if (stored === null) localStorage.setItem("theme-image", "1");
  }
} catch (e) {
  console.error("Failed to set theme:", e);
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
