"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Download } from "lucide-react";
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function RiskBadge({ risk }: { risk: string }) {
  return (
    <Badge
      tone={
        risk === "Critical Alert"
          ? "danger"
          : risk === "Moderate Risk"
            ? "warning"
            : "success"
      }
    >
      {risk}
    </Badge>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ReportLink({
  kind,
  studentId,
  department,
  label = "Download PDF",
}: {
  kind: "student" | "analytics" | "audit" | "json";
  studentId?: string;
  department?: string;
  label?: string;
}) {
  return (
    <a
      className="button secondary"
      href={`/api/reports?kind=${kind}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ""}${department ? `&department=${encodeURIComponent(department)}` : ""}`}
      download
    >
      <Download size={16} />
      {label}
    </a>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
