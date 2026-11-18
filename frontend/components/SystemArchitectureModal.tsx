"use client";
import { ArrowRight } from "lucide-react";
import { industryMatrix } from "@/frontend/lib/presentation";
import { Modal } from "./ui";
import {
  educationSourceMap,
  educationLifecycle,
} from "@/frontend/lib/courseAlignment";
export function SystemArchitectureModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return (
    <Modal title="EDM course alignment" wide onClose={onClose}>
      <div className="modal-body">
        <h3>Education / Universities</h3>
        <div className="lifecycle-line">
          <span>Sources</span>
          <ArrowRight size={18} />
          <span>Integration</span>
          <ArrowRight size={18} />
          <span>Governance</span>
          <ArrowRight size={18} />
          <span>Outputs</span>
        </div>
        <p className="small" style={{ marginBottom: 24 }}>
          Implemented flow: SIS, LMS, Library → validated ingestion and ETL →
          server role checks and masking → Student 360 and academic analytics.
        </p>
        <div className="table-wrap">
          <table className="slide-matrix">
            <thead>
              <tr>
                {[
                  "Industry",
                  "Data sources",
                  "Integration methods",
                  "Governance needs",
                  "Outputs",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {industryMatrix.map((row, i) => (
                <tr key={row[0]} className={i === 4 ? "matrix-highlight" : ""}>
                  {row.map((cell, j) => (
                    <td key={j}>{j === 0 ? <strong>{cell}</strong> : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small" style={{ marginTop: 20 }}>
          Matrix from the course slides. HR, Alumni CRM, Data Fabric and live
          vendor APIs remain proposed extensions.
        </p>
        <h3 style={{ marginTop: 28 }}>
          University source and responsibility map
        </h3>
        <p className="small" style={{ margin: "8px 0 16px" }}>
          Working and proposed sources.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Source / owner",
                  "Data and integration",
                  "Governance and output",
                  "Status",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {educationSourceMap.map((s) => (
                <tr key={s.source}>
                  <td>
                    <strong>{s.source}</strong>
                    <div className="small muted">{s.owner}</div>
                  </td>
                  <td>
                    {s.data}
                    <div className="small muted">{s.integration}</div>
                  </td>
                  <td>
                    {s.governance}
                    <div className="small muted">{s.output}</div>
                  </td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: 28 }}>Enrollment through alumni</h3>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Lifecycle stage</th>
                <th>Evidence and boundary</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {educationLifecycle.map((s) => (
                <tr key={s.stage}>
                  <td>
                    <strong>{s.stage}</strong>
                  </td>
                  <td>{s.evidence}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: 28 }}>
          Integration choice and governance boundary
        </h3>
        <p className="small" style={{ marginTop: 8 }}>
          Batch ETL validates uploads before publishing the master. ELT, CDC,
          virtualization and Data Fabric are lecture alternatives. Live vendor
          synchronization is not implemented.
        </p>
        <p className="small" style={{ marginTop: 12 }}>
          Role checks, masking, scoped exports and audit history demonstrate
          FERPA/GDPR governance concepts, not certified compliance.
        </p>
      </div>
    </Modal>
  );
}
