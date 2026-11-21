"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Download, Package } from "lucide-react";

function ProductImageInner({
  src,
  alt,
  size,
  className = "",
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={`product-image-fallback ${className}`.trim()}
        aria-label={alt}
      >
        <Package size={Math.max(16, Math.round(size * 0.34))} />
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="eager"
      unoptimized
      className={className}
      style={{ objectFit: "contain", width: "100%", height: "100%" }}
      onError={() => setFailed(true)}
    />
  );
}

export function ProductImage({
  src,
  alt,
  size = 140,
  className = "",
}: {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <span
        className={`product-image-fallback ${className}`.trim()}
        aria-label={alt}
      >
        <Package size={Math.max(16, Math.round(size * 0.34))} />
      </span>
    );
  }
  return (
    <ProductImageInner
      key={src}
      src={src}
      alt={alt}
      size={size}
      className={className}
    />
  );
}

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
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

export function StockStatusBadge({
  status,
}: {
  status: "Synced" | "Low Stock" | "Oversell Risk";
}) {
  return (
    <Badge
      tone={
        status === "Oversell Risk"
          ? "danger"
          : status === "Low Stock"
            ? "warning"
            : "success"
      }
    >
      {status}
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
  customerId,
  channel,
  label = "Download PDF",
}: {
  kind: "customer" | "sales" | "audit" | "json";
  customerId?: string;
  channel?: string;
  label?: string;
}) {
  return (
    <a
      className="button secondary"
      href={`/api/reports?kind=${kind}${customerId ? `&customerId=${encodeURIComponent(customerId)}` : ""}${channel ? `&channel=${encodeURIComponent(channel)}` : ""}`}
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
