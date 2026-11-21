"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CRMRecord,
  CheckoutReceipt,
  Feed,
  LogisticsRecord,
  RetailSnapshot,
  UserRole,
} from "@/shared/types";
import type { Branch, Carrier, ProductCategory } from "@/shared/retail";
import { broadcastDataChange, subscribeDataChanges } from "@/frontend/lib/liveSync";
import { useRouter } from "next/navigation";

interface EDMContextType extends RetailSnapshot {
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  notice: string | null;
  requiresSignIn: boolean;
  signOut: () => Promise<void>;
  setCurrentRole: (role: UserRole) => Promise<boolean>;
  executeSync: () => Promise<boolean>;
  resetAllData: () => Promise<boolean>;
  importFile: (feed: Feed, file: File) => Promise<boolean>;
  recordPOSSale: (input: {
    branch: Branch;
    sku: string;
    customerId: string;
    quantity: number;
    paymentMethod: "Card" | "Cash" | "GCash";
  }) => Promise<boolean>;
  recordOnlineOrder: (input: {
    sku: string;
    customerId: string;
    quantity: number;
    carrier: Carrier;
    paymentMethod: "Card" | "GCash" | "Maya";
  }) => Promise<boolean>;
  processCheckout: (input: {
    channel: "POS" | "ONLINE";
    branch?: Branch;
    customerId: string;
    paymentMethod: "Card" | "Cash" | "GCash" | "Maya";
    cardNumber?: string;
    carrier?: Carrier;
    items: Array<{ sku: string; quantity: number }>;
  }) => Promise<CheckoutReceipt | null>;
  createCustomer: (input: {
    fullName: string;
    email: string;
    phone: string;
    preferredBranch: Branch;
    favoriteCategory: ProductCategory;
    loyaltyTier: CRMRecord["loyaltyTier"];
    gdprConsent: CRMRecord["gdprConsent"];
  }) => Promise<boolean>;
  dispatchOrder: (orderId: string, carrier: Carrier) => Promise<boolean>;
  updateShipment: (
    shipmentId: string,
    status: LogisticsRecord["status"],
    delayReason?: string,
  ) => Promise<boolean>;
  transferStock: (input: {
    sku: string;
    fromChannel: "Manila" | "Cebu" | "Online";
    toChannel: "Manila" | "Cebu" | "Online";
    quantity: number;
  }) => Promise<boolean>;
  simulateSeasonalSpike: () => Promise<boolean>;
  restockSKU: (sku: string, amount?: number) => Promise<boolean>;
  importCatalogProduct: (productId: number) => Promise<boolean>;
  toggleGDPRConsent: (customerId: string) => Promise<boolean>;
  viewCustomer: (customerId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  dismissMessage: () => void;
}

const Context = createContext<EDMContextType | undefined>(undefined);

const empty: RetailSnapshot = {
  currentRole: "OPS_MANAGER",
  actorName: "Loading session",
  posRecords: [],
  inventoryRecords: [],
  crmRecords: [],
  onlineRecords: [],
  logisticsRecords: [],
  stockItems: [],
  customers: [],
  cdcEvents: [],
  consistencyAlerts: [],
  etlReports: [],
  auditLogs: [],
  sourceCounts: { POS: 0, INVENTORY: 0, CRM: 0, ONLINE: 0, LOGISTICS: 0 },
  salesSummary: {
    totalRevenue: 0,
    posManilaRevenue: 0,
    posCebuRevenue: 0,
    onlineRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    onTimeDeliveryRate: 100,
    delayedShipments: 0,
    revenueByCategory: [],
    carrierPerformance: [],
  },
  auditIntegrity: true,
  lastSyncedAt: new Date().toISOString(),
};

async function fetchSnapshot(): Promise<RetailSnapshot> {
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

  const syncingRef = useRef(false);
  const requiresSignInRef = useRef(false);
  const backgroundInFlightRef = useRef(false);

  useEffect(() => {
    syncingRef.current = isSyncing;
  }, [isSyncing]);

  useEffect(() => {
    requiresSignInRef.current = requiresSignIn;
  }, [requiresSignIn]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
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
        if (active) {
          setData(result);
          setRequiresSignIn(false);
          setError(null);
        }
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

  useEffect(() => {
    if (requiresSignIn) return;
    let active = true;
    const stop = subscribeDataChanges(
      () => {
        if (
          syncingRef.current ||
          requiresSignInRef.current ||
          backgroundInFlightRef.current
        ) {
          return;
        }
        backgroundInFlightRef.current = true;
        void fetchSnapshot()
          .then((result) => {
            if (!active || syncingRef.current) return;
            setData(result);
            setRequiresSignIn(false);
          })
          .catch((e) => {
            if (
              active &&
              e instanceof Error &&
              e.name === "AuthenticationRequired"
            ) {
              setData(empty);
              setRequiresSignIn(true);
            }
          })
          .finally(() => {
            backgroundInFlightRef.current = false;
          });
      },
      { pollMs: 8000 },
    );
    return () => {
      active = false;
      stop();
    };
  }, [requiresSignIn]);

  const postCommand = async (
    body: { type: string; [key: string]: unknown },
    hide = false,
  ): Promise<{ ok: boolean; receipt?: CheckoutReceipt }> => {
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
      if (result.snapshot) {
        setData(result.snapshot);
        if (body.type !== "view") broadcastDataChange("hub");
      } else if (result.auditEntry) {
        setData((current) => ({
          ...current,
          auditLogs: [result.auditEntry, ...current.auditLogs],
        }));
      }
      if (body.type !== "view" && result.message) setNotice(result.message);
      return { ok: true, receipt: result.receipt as CheckoutReceipt | undefined };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Try again.");
      return { ok: false };
    } finally {
      setSyncing(false);
      if (hide) setLoading(false);
    }
  };

  const command = async (body: { type: string; [key: string]: unknown }, hide = false) =>
    (await postCommand(body, hide)).ok;

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
            setNotice(null);
            setError(null);
            setRequiresSignIn(true);
            router.replace("/login");
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
        setCurrentRole: (role) => command({ type: "role", role }),
        executeSync: () => command({ type: "sync" }),
        resetAllData: () => command({ type: "reset" }),
        recordPOSSale: (input) => command({ type: "pos_sale", ...input }),
        recordOnlineOrder: (input) =>
          command({ type: "online_order", ...input }),
        processCheckout: async (input) => {
          const res = await postCommand({ type: "checkout", ...input });
          return res.ok && res.receipt ? res.receipt : null;
        },
        createCustomer: (input) =>
          command({ type: "create_customer", ...input }),
        dispatchOrder: (orderId, carrier) =>
          command({ type: "dispatch_order", orderId, carrier }),
        updateShipment: (shipmentId, status, delayReason) =>
          command({ type: "update_shipment", shipmentId, status, delayReason }),
        transferStock: (input) => command({ type: "transfer_stock", ...input }),
        simulateSeasonalSpike: () => command({ type: "seasonal_spike" }),
        restockSKU: (sku, amount = 20) =>
          command({ type: "restock", sku, amount }),
        importCatalogProduct: (productId) =>
          command({ type: "import_catalog_product", productId }),
        toggleGDPRConsent: (customerId) =>
          command({ type: "toggle_gdpr", customerId }),
        viewCustomer: (customerId) => command({ type: "view", customerId }),
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
