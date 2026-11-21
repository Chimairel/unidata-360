"use client";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ChartNoAxesCombined,
  Globe,
  Layers,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import type { Feed } from "@/shared/types";
import "./RetailFlowchart.css";

interface FlowchartProps {
  sourceCounts?: Record<Feed, number>;
  customerCount?: number;
}

export function RetailFlowchart({
  sourceCounts,
  customerCount,
}: FlowchartProps) {
  const sources = [
    {
      name: "POS Systems",
      detail: "Manila & Cebu checkout + tokenized cards",
      count: sourceCounts?.POS,
      icon: Store,
    },
    {
      name: "Inventory Mgmt",
      detail: "Branch + online warehouse stock levels",
      count: sourceCounts?.INVENTORY,
      icon: Package,
    },
    {
      name: "Customer CRM",
      detail: "Loyalty tiers, preferences & GDPR consent",
      count: sourceCounts?.CRM,
      icon: Users,
    },
    {
      name: "Online Storefronts",
      detail: "Web & app orders, promo codes & checkout",
      count: sourceCounts?.ONLINE,
      icon: Globe,
    },
    {
      name: "3PL Logistics",
      detail: "LBC, J&T, GrabExpress & DHL tracking",
      count: sourceCounts?.LOGISTICS,
      icon: Truck,
    },
  ];

  const outputs = [
    {
      name: "Real-Time Stock Sync",
      detail: "Branch + warehouse counts, Low Stock & Oversell alerts",
      icon: Package,
    },
    {
      name: "Personalized Offers",
      detail:
        customerCount !== undefined
          ? `${customerCount} profiles · GDPR Opt-Out suppression`
          : "Tiered offers suppressed on GDPR Opt-Out",
      icon: Tag,
    },
    {
      name: "Unified Sales Analytics",
      detail: "Manila POS + Cebu POS + Online revenue & 3PL SLA",
      icon: ChartNoAxesCombined,
    },
    {
      name: "Compliance Reports",
      detail: "PCI/GDPR masked PDF, JSON & SHA-256 audit CSV",
      icon: ShieldCheck,
    },
  ];

  return (
    <div
      className="edm-flowchart"
      role="region"
      aria-label="Retail and e-commerce enterprise data integration flowchart"
    >
      <div className="flowchart-main">
        <section
          className="flowchart-column"
          aria-label="Retail data sources"
        >
          <div className="flowchart-column-title">1. Data sources</div>
          <div className="flowchart-stack">
            {sources.map((source) => (
              <div key={source.name} className="flowchart-node is-live">
                <div className="flowchart-node-head">
                  <source.icon size={15} />
                  <strong>{source.name}</strong>
                  {source.count !== undefined && (
                    <span className="flowchart-tag">{source.count} rows</span>
                  )}
                </div>
                <span>{source.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="flowchart-connector" aria-hidden="true">
          <span className="flowchart-connector-label">APIs &amp; CDC</span>
          <ArrowRight size={18} />
        </div>

        <section
          className="flowchart-hub"
          aria-label="Karto retail integration hub"
        >
          <div className="flowchart-column-title">
            2 &amp; 3. Integration &amp; Governance Hub
          </div>
          <div className="flowchart-hub-pillars">
            <div className="flowchart-pillar">
              <div className="flowchart-pillar-head">
                <Layers size={15} />
                <strong>Real-Time APIs · CDC · Virtualization</strong>
              </div>
              <span>
                Live checkout APIs + append-only Change Data Capture stream +
                virtualized Customer 360 + CSV/JSON ingestion
              </span>
            </div>
            <div className="flowchart-pillar">
              <div className="flowchart-pillar-head">
                <ShieldCheck size={15} />
                <strong>PCI DSS &amp; GDPR Governance</strong>
              </div>
              <span>
                Server-side PAN tokenization · GDPR Opt-Out offer suppression ·
                branch isolation · append-only SHA-256 audit chain
              </span>
            </div>
            <div className="flowchart-pillar">
              <div className="flowchart-pillar-head">
                <Activity size={15} />
                <strong>Cross-Channel Consistency</strong>
              </div>
              <span>
                Detects 11.11 oversell spikes, 3PL delays, missing tracking
                numbers &amp; unlinked POS walk-ins
              </span>
            </div>
          </div>
        </section>

        <div className="flowchart-connector" aria-hidden="true">
          <span className="flowchart-connector-label">Scoped outputs</span>
          <ArrowRight size={18} />
        </div>

        <section className="flowchart-column" aria-label="Retail outputs">
          <div className="flowchart-column-title">4. Outputs</div>
          <div className="flowchart-stack">
            {outputs.map((output) => (
              <div key={output.name} className="flowchart-node is-live">
                <div className="flowchart-node-head">
                  <output.icon size={15} />
                  <strong>{output.name}</strong>
                </div>
                <span>{output.detail}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flowchart-down" aria-hidden="true">
        <ArrowDown size={16} />
        <span>
          Unified omnichannel data warehouse powers live retail operations
        </span>
      </div>

      <div
        className="flowchart-downstream"
        aria-label="Retail outcomes and resilience"
      >
        <div className="flowchart-node is-downstream">
          <div className="flowchart-node-head">
            <Sparkles size={15} />
            <strong>Seasonal Spike Resilience</strong>
          </div>
          <span>
            Immediate stock deduction &amp; oversell flagging during 11.11 peak
            flash sales
          </span>
        </div>
        <div className="flowchart-node is-downstream">
          <div className="flowchart-node-head">
            <Truck size={15} />
            <strong>3PL SLA Tracking</strong>
          </div>
          <span>
            Multi-carrier visibility across LBC, J&amp;T, GrabExpress &amp; DHL
          </span>
        </div>
        <div className="flowchart-node is-downstream">
          <div className="flowchart-node-head">
            <ShieldCheck size={15} />
            <strong>PCI &amp; GDPR Auditability</strong>
          </div>
          <span>Tamper-evident hash chain &amp; role-governed exports</span>
        </div>
      </div>
    </div>
  );
}
