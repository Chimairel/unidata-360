"use client";
import { industryMatrix } from "@/frontend/lib/presentation";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { Modal } from "./ui";
import { RetailFlowchart } from "./RetailFlowchart";
import {
  retailSourceMap,
  retailChallenges,
} from "@/frontend/lib/courseAlignment";

export function SystemArchitectureModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { sourceCounts, customers } = useEDM();
  if (!isOpen) return null;
  return (
    <Modal title="Retail & E-Commerce EDM Alignment" wide onClose={onClose}>
      <div className="modal-body">
        <h3>Retail &amp; E-Commerce — Integration flowchart</h3>
        <p className="small" style={{ marginBottom: 16 }}>
          All 5 sources (POS, Inventory, CRM, Online Storefronts, 3PL Logistics)
          flow live through Karto’s Real-Time API, CDC, Virtualization, and
          PCI DSS / GDPR Governance hub.
        </p>
        <RetailFlowchart
          sourceCounts={sourceCounts}
          customerCount={customers.length}
        />

        <h3 style={{ marginTop: 28 }}>Comparative industry matrix</h3>
        <div className="table-wrap" style={{ marginTop: 12 }}>
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
                <tr key={row[0]} className={i === 2 ? "matrix-highlight" : ""}>
                  {row.map((cell, j) => (
                    <td key={j}>{j === 0 ? <strong>{cell}</strong> : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: 28 }}>
          5-source retail map &amp; ownership
        </h3>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Source / owner</th>
                <th>Data &amp; integration</th>
                <th>Governance &amp; output</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {retailSourceMap.map((s) => (
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

        <h3 style={{ marginTop: 28 }}>
          Integration methods, governance &amp; challenges
        </h3>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Slide requirement</th>
                <th>Live implementation in Karto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {retailChallenges.map((c) => (
                <tr key={c.pillar}>
                  <td>
                    <strong>{c.pillar}</strong>
                  </td>
                  <td>{c.evidence}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
