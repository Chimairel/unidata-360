"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import "./AuthControls.css";

type Theme = "light" | "dark";
const themeKey = "unidata-theme";
const snapshot = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const serverSnapshot = (): Theme => "light";

let shortcutConsumers = 0;

function toggleTheme() {
  const next: Theme = snapshot() === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(themeKey, next);
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(themeKey));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    Boolean(
      target.closest(
        "input, textarea, select, [contenteditable='true'], [contenteditable='']",
      ),
    )
  );
}

function onThemeShortcut(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    typeof event.key !== "string" ||
    event.key.toLowerCase() !== "d" ||
    isEditableTarget(event.target)
  ) {
    return;
  }
  toggleTheme();
}

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

  useEffect(() => {
    if (shortcutConsumers === 0) {
      window.addEventListener("keydown", onThemeShortcut);
    }
    shortcutConsumers += 1;
    return () => {
      shortcutConsumers -= 1;
      if (shortcutConsumers === 0) {
        window.removeEventListener("keydown", onThemeShortcut);
      }
    };
  }, []);

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={`Use ${next} theme`}
      title={`Use ${next} theme (D)`}
      onClick={toggleTheme}
    >
      {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
    </button>
  );
}
