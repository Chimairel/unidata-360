"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Badge,
  EmptyState,
  Modal,
  PageHeading,
} from "@/frontend/components/ui";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import {
  buildQualityRows,
  qualityFeeds,
  type QualityStatus,
} from "@/frontend/lib/dataQuality";
import type { Feed } from "@/shared/types";
import "./DataQualityTab.css";

const qualityStatuses = {
  critical: { label: "Critical", tone: "danger" },
  warning: { label: "Warning", tone: "warning" },
  clear: { label: "Pass", tone: "success" },
} satisfies Record<QualityStatus, { label: string; tone: string }>;

const statuses = Object.keys(qualityStatuses) as QualityStatus[];
const checks = [
  "Completeness",
  "Consistency",
  "Validity",
  "Stock monitoring",
  "Delivery monitoring",
];
const PAGE_SIZE = 12;

export function DataQualityTab() {
  const {
    posRecords,
    inventoryRecords,
    crmRecords,
    onlineRecords,
    logisticsRecords,
    consistencyAlerts,
  } = useEDM();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Feed | "all">("all");
  const [status, setStatus] = useState<QualityStatus | "all">("all");
  const [dimension, setDimension] = useState("");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      buildQualityRows({
        posRecords,
        inventoryRecords,
        crmRecords,
        onlineRecords,
        logisticsRecords,
        consistencyAlerts,
      }),
    [
      posRecords,
      inventoryRecords,
      crmRecords,
      onlineRecords,
      logisticsRecords,
      consistencyAlerts,
    ],
  );
  const counts = { critical: 0, warning: 0, clear: 0 };
  const search = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    counts[row.status]++;
    return (
      (source === "all" || row.feed === source) &&
      (status === "all" || row.status === status) &&
      (!dimension ||
        row.issues.some((issue) => issue.dimension === dimension)) &&
      (!search ||
        [
          row.reference,
          row.name,
          row.summary,
          ...Object.values(row.fields),
        ].some((value) => String(value).toLowerCase().includes(search)))
    );
  });
  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const start = (currentPage - 1) * PAGE_SIZE;
  const activeRow = rows.find((row) => row.key === selectedKey);
  const hasFilters = query || source !== "all" || dimension || status !== "all";

  function resetFilters() {
    setQuery("");
    setSource("all");
    setStatus("all");
    setDimension("");
    setPage(1);
  }

  return (
    <div className="page-stack quality-page">
      <PageHeading
        title="Data Quality"
        description="Inspect the five retail feeds. Open a record to see the checked values and the reason for each flag."
      />
      <section className="quality-register panel" aria-label="Retail records">
        <div className="quality-controls">
          <div
            className="quality-status-filters"
            role="group"
            aria-label="Record status"
          >
            <button
              type="button"
              aria-pressed={status === "all"}
              onClick={() => {
                setStatus("all");
                setPage(1);
              }}
            >
              All records <span>{rows.length}</span>
            </button>
            {statuses.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <span
                  className={`quality-dot ${qualityStatuses[value].tone}`}
                  aria-hidden="true"
                />
                {qualityStatuses[value].label}
                <span>{counts[value]}</span>
              </button>
            ))}
          </div>
          <div className="quality-fields">
            <label className="quality-search">
              Search records
              <span>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  placeholder="Order, product, customer or tracking number"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </span>
            </label>
            <label>
              <span id="quality-source-label">Source</span>
              <select
                aria-labelledby="quality-source-label"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value as Feed | "all");
                  setPage(1);
                }}
              >
                <option value="all">All sources</option>
                {Object.entries(qualityFeeds).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span id="quality-check-label">Check</span>
              <select
                aria-labelledby="quality-check-label"
                value={dimension}
                onChange={(event) => {
                  setDimension(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All checks</option>
                {checks.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <button
              className="button secondary"
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
            >
              Reset filters
            </button>
          </div>
        </div>
        {filtered.length ? (
          <div
            className="table-wrap quality-table-wrap"
            role="region"
            aria-label="Data quality results"
            tabIndex={0}
          >
            <table className="quality-table">
              <caption className="sr-only">
                Detected issues in Karto retail records
              </caption>
              <thead>
                <tr>
                  <th scope="col">Record</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                  <th scope="col">Recorded values</th>
                  <th scope="col">Findings</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(start, start + PAGE_SIZE).map((row) => (
                  <tr key={row.key}>
                    <td>
                      <button
                        className="quality-record-link"
                        type="button"
                        onClick={() => setSelectedKey(row.key)}
                        aria-label={`Inspect ${row.reference}`}
                      >
                        {row.name}
                        <span className="mono">{row.reference}</span>
                      </button>
                    </td>
                    <td>
                      <Badge tone={qualityStatuses[row.status].tone}>
                        {qualityStatuses[row.status].label}
                      </Badge>
                    </td>
                    <td>{qualityFeeds[row.feed]}</td>
                    <td className="quality-values">{row.summary}</td>
                    <td>
                      <div className="quality-findings">
                        {row.issues.length ? (
                          row.issues.map((issue) => (
                            <Badge
                              key={issue.label}
                              tone={qualityStatuses[issue.severity].tone}
                            >
                              {issue.label}
                            </Badge>
                          ))
                        ) : (
                          <span className="quality-clear">No flags</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={rows.length ? "No matching records" : "No feed records"}
          >
            {rows.length
              ? "Change the search or reset the filters."
              : "Records will appear when the retail feeds contain data."}
          </EmptyState>
        )}
        <div className="quality-pagination">
          <p aria-live="polite">
            {filtered.length
              ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} records`
              : "0 records"}
          </p>
          {lastPage > 1 && (
            <div>
              <button
                className="icon-button"
                aria-label="Previous page"
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                Page {currentPage} of {lastPage}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                type="button"
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </section>
      {activeRow && (
        <Modal title={activeRow.reference} onClose={() => setSelectedKey(null)}>
          <div className="modal-body quality-detail">
            <div className="quality-detail-title">
              <div>
                <h3>{activeRow.name}</h3>
                <p>{qualityFeeds[activeRow.feed]}</p>
              </div>
              <Badge tone={qualityStatuses[activeRow.status].tone}>
                {qualityStatuses[activeRow.status].label}
              </Badge>
            </div>
            <dl className="quality-detail-fields">
              {Object.entries(activeRow.fields).map(([field, value]) => (
                <div key={field}>
                  <dt>{field}</dt>
                  <dd
                    className={
                      activeRow.issues.some((issue) => issue.field === field)
                        ? "quality-flagged-value"
                        : undefined
                    }
                  >
                    {value === "" ? "Missing" : value}
                  </dd>
                </div>
              ))}
            </dl>
            <h3>Check results</h3>
            {activeRow.issues.length ? (
              <ul className="quality-detail-issues">
                {activeRow.issues.map((issue) => (
                  <li key={issue.label}>
                    <div>
                      <strong>{issue.label}</strong>
                      <Badge tone={qualityStatuses[issue.severity].tone}>
                        {issue.dimension}
                      </Badge>
                    </div>
                    <p>{issue.explanation}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No issues were flagged by the available checks.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
