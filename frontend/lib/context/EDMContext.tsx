"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { EDMSnapshot, Feed, UserRole } from "@/shared/types";
import { useRouter } from "next/navigation";

interface EDMContextType extends EDMSnapshot {
  maskedMasterRecords: EDMSnapshot["masterRecords"];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  notice: string | null;
  requiresSignIn: boolean;
  signOut: () => Promise<void>;
  setCurrentRole: (role: UserRole) => Promise<boolean>;
  executeETL: () => Promise<boolean>;
  resetAllData: () => Promise<boolean>;
  importFile: (feed: Feed, file: File) => Promise<boolean>;
  importRecords: (feed: Feed, content: string) => Promise<boolean>;
  viewStudent: (studentId: string) => Promise<boolean>;
  assignAdvisor: (studentId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  dismissMessage: () => void;
}
const Context = createContext<EDMContextType | undefined>(undefined);
const empty: EDMSnapshot = {
  currentRole: "REGISTRAR",
  actorName: "Loading session",
  sisRecords: [],
  lmsRecords: [],
  libraryRecords: [],
  masterRecords: [],
  etlReports: [],
  auditLogs: [],
  interventions: [],
  sourceCounts: { SIS: 0, LMS: 0, LIBRARY: 0 },
  auditIntegrity: true,
};
async function fetchSnapshot(): Promise<EDMSnapshot> {
  const response = await fetch("/api/edm", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error);
    if (response.status === 401) error.name = "AuthenticationRequired";
    throw error;
  }
  return result;
}
export function EDMProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState(empty);
  const [isLoading, setLoading] = useState(true);
  const [isSyncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSnapshot());
      setRequiresSignIn(false);
    } catch (e) {
      if (e instanceof Error && e.name === "AuthenticationRequired") {
        setData(empty);
        setRequiresSignIn(true);
      }
      setError(e instanceof Error ? e.message : "Cannot connect. Try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    void fetchSnapshot()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active && e instanceof Error && e.name === "AuthenticationRequired")
          setRequiresSignIn(true);
        if (active)
          setError(
            e instanceof Error ? e.message : "Cannot connect. Try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const command = async (body: object, hide = false) => {
    setError(null);
    setNotice(null);
    setSyncing(true);
    if (hide) setLoading(true);
    try {
      const response = await fetch("/api/edm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setData(empty);
          setRequiresSignIn(true);
        }
        throw new Error(result.error);
      }
      setData(result.snapshot);
      if (!("studentId" in body)) setNotice(result.message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Try again.");
      return false;
    } finally {
      setSyncing(false);
      if (hide) setLoading(false);
    }
  };
  const importFile = async (feed: Feed, file: File) => {
    if (file.size > 2_000_000) {
      setError("File too large. Upload a CSV or JSON file under 2 MB.");
      return false;
    }
    const format = file.name.toLowerCase().endsWith(".csv")
      ? "csv"
      : file.name.toLowerCase().endsWith(".json")
        ? "json"
        : null;
    if (!format) {
      setError("Choose a .csv or .json file.");
      return false;
    }
    try {
      return await command({
        type: "import",
        feed,
        format,
        content: await file.text(),
      });
    } catch {
      setError("The file could not be read. Choose it again.");
      return false;
    }
  };
  return (
    <Context.Provider
      value={{
        ...data,
        maskedMasterRecords: data.masterRecords,
        isLoading,
        isSyncing,
        error,
        notice,
        requiresSignIn,
        signOut: async () => {
          setSyncing(true);
          try {
            const response = await fetch("/api/auth", { method: "DELETE" });
            if (!response.ok) throw new Error("Sign-out failed. Try again.");
            setData(empty);
            router.replace("/login");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-out failed.");
          } finally {
            setSyncing(false);
          }
        },
        refresh,
        importFile,
        dismissMessage: () => {
          setError(null);
          setNotice(null);
        },
        importRecords: (feed, content) =>
          command({ type: "import", feed, format: "json", content }),
        setCurrentRole: (role) => command({ type: "role", role }, true),
        executeETL: () => command({ type: "sync" }),
        resetAllData: () => command({ type: "reset" }),
        viewStudent: (studentId) => command({ type: "view", studentId }),
        assignAdvisor: (studentId) =>
          command({ type: "intervention", studentId }),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useEDM() {
  const context = useContext(Context);
  if (!context) throw new Error("EDMProvider is required");
  return context;
}
