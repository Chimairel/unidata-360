"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const themeKey = "unidata-theme";
const snapshot = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const serverSnapshot = (): Theme => "light";

function subscribe(notify: () => void) {
  const syncStorage = (event: StorageEvent) => {
    if (event.key !== themeKey && event.key !== null) return;
    document.documentElement.dataset.theme =
      event.newValue === "dark" ? "dark" : "light";
    notify();
  };
  window.addEventListener(themeKey, notify);
  window.addEventListener("storage", syncStorage);
  return () => {
    window.removeEventListener(themeKey, notify);
    window.removeEventListener("storage", syncStorage);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={`Use ${next} theme`}
      title={`Use ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(themeKey, next);
        } catch {
          // Theme switching still works when browser storage is unavailable.
        }
        window.dispatchEvent(new Event(themeKey));
      }}
    >
      {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
    </button>
  );
}
