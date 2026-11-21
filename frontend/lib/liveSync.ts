const CHANNEL_NAME = "karto-live-sync";
const STORAGE_KEY = "karto-live-sync-ts";

export type LiveSyncSource = "shop" | "hub";

/**
 * Notify other open tabs in this browser that live Karto data changed.
 */
export function broadcastDataChange(source: LiveSyncSource): void {
  if (typeof window === "undefined") return;
  const payload = { source, ts: Date.now() };
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // Fallback storage event handles environments without BroadcastChannel.
  }
  try {
    localStorage.setItem(STORAGE_KEY, `${source}:${payload.ts}`);
  } catch {
    // Ignore storage quota or private browsing restrictions.
  }
}

/**
 * Subscribe to cross-tab change broadcasts, tab focus/visibility, and gentle polling.
 */
export function subscribeDataChanges(
  onChange: () => void,
  options?: { pollMs?: number },
): () => void {
  if (typeof window === "undefined") return () => {};

  const pollMs = options?.pollMs ?? 8000;
  let lastTrigger = 0;

  const trigger = () => {
    const now = Date.now();
    if (now - lastTrigger < 350) return;
    lastTrigger = now;
    onChange();
  };

  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener("message", trigger);
    }
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) trigger();
  };
  const onFocus = () => {
    if (document.visibilityState === "visible") trigger();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") trigger();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") trigger();
  }, pollMs);

  return () => {
    channel?.removeEventListener("message", trigger);
    channel?.close();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(timer);
  };
}
