"use client";
import { useCallback, useEffect, useState } from "react";
export function useWorkflowWorkspace<T>(path: string, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return null;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(path, { cache: "no-store", signal });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "This workspace could not be loaded.",
          );
        if (!signal?.aborted) {
          setData(result);
          setMessage("");
        }
        return result as T;
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Reload this workspace to try again.",
          );
        return null;
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [path, enabled],
  );
  useEffect(() => {
    const controller = new AbortController();
    if (enabled)
      void fetch(path, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok)
            throw new Error(
              result.error || "This workspace could not be loaded.",
            );
          return result as T;
        })
        .then((result) => {
          if (!controller.signal.aborted) setData(result);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(
              e instanceof Error
                ? e.message
                : "Reload this workspace to try again.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    return () => controller.abort();
  }, [path, enabled]);
  async function save(body: object) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "The change could not be saved.");
      setData(result);
      setMessage(result.message || "Saved.");
      return result as T;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The change could not be saved.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { data, loading, busy, error, message, reload, save };
}
