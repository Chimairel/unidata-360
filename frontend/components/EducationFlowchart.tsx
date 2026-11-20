"use client";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Briefcase,
  ChartNoAxesCombined,
  ClipboardCheck,
  Database,
  FileText,
  GraduationCap,
  Layers,
  Library,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { Feed } from "@/shared/types";
import "./EducationFlowchart.css";

interface FlowchartProps {
  sourceCounts?: Record<Feed, number>;
  masterCount?: number;
}

export function EducationFlowchart({
  sourceCounts,
  masterCount,
}: FlowchartProps) {
  const sources = [
    {
      name: "SIS",
      detail: "Enrollment, GWA (1.00–5.00) & identity",
      status: "Live feed",
      live: true,
      count: sourceCounts?.SIS,
      icon: Database,
    },
    {
      name: "LMS",
      detail: "Courses, scores & attendance",
      status: "Live feed",
      live: true,
      count: sourceCounts?.LMS,
      icon: BookOpen,
    },
    {
      name: "Library",
      detail: "Loans, fines & clearance",
      status: "Live feed",
      live: true,
      count: sourceCounts?.LIBRARY,
      icon: Library,
    },
    {
      name: "HR / Payroll",
      detail: "Faculty advisors, courses & masked payroll",
      status: "Live feed",
      live: true,
      count: sourceCounts?.HR,
      icon: Briefcase,
    },
    {
      name: "Alumni CRM",
      detail: "Graduates, employment & GDPR consent",
      status: "Live feed",
      live: true,
      count: sourceCounts?.ALUMNI,
      icon: GraduationCap,
    },
  ];

  const outputs = [
    {
      name: "Student 360 Dossier",
      detail:
        masterCount !== undefined
          ? `${masterCount} unified records · graduation context`
          : "Unified lifecycle & graduation context",
      icon: Users,
    },
    {
      name: "Advising Cases",
      detail: "Assigned staff, private notes & outcomes",
      icon: ClipboardCheck,
    },
    {
      name: "Quality & Lineage",
      detail: "Stewardship queue, relinking & provenance",
      icon: ListChecks,
    },
    {
      name: "Compliance Reports",
      detail: "Scoped PDF, JSON & audit CSV exports",
      icon: FileText,
    },
  ];

  return (
    <div
      className="edm-flowchart"
      role="region"
      aria-label="Education enterprise data integration flowchart"
    >
      <div className="flowchart-main">
        <section
          className="flowchart-column"
          aria-label="University data sources"
        >
          <div className="flowchart-column-title">1. Data sources</div>
          <div className="flowchart-stack">
            {sources.map((source) => (
              <div
                key={source.name}
                className={`flowchart-node ${source.live ? "is-live" : "is-mapped"}`}
              >
                <div className="flowchart-node-head">
                  <source.icon size={15} />
                  <strong>{source.name}</strong>
                  <span className="flowchart-tag">
                    {source.live && source.count !== undefined
                      ? `${source.count} rows`
                      : source.status}
                  </span>
                </div>
                <span>{source.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="flowchart-connector" aria-hidden="true">
          <span className="flowchart-connector-label">CSV / JSON APIs</span>
          <ArrowRight size={18} />
        </div>

        <section
          className="flowchart-hub"
          aria-label="Estante data integration hub"
        >
          <div className="flowchart-column-title">
            2 &amp; 3. Estante Integration Hub
          </div>
          <div className="flowchart-hub-pillars">
            <div className="flowchart-pillar">
              <div className="flowchart-pillar-head">
                <ListChecks size={15} />
                <strong>Data Quality Management</strong>
              </div>
              <span>
                Schema validation · name/date/code cleansing · deduplication ·
                orphan &amp; missing-feed monitoring
              </span>
            </div>
            <div className="flowchart-pillar">
              <div className="flowchart-pillar-head">
                <ShieldCheck size={15} />
                <strong>Data Governance (FERPA / GDPR)</strong>
              </div>
              <span>
                6-role RBAC · department &amp; self-access scope · server field
                masking · append-only SHA-256 audit chain
              </span>
            </div>
            <div className="flowchart-pillar">
              <div className="flowchart-pillar-head">
                <Layers size={15} />
                <strong>Integration Engine</strong>
              </div>
              <span>
                5 live feeds · Batch ETL · REST APIs · PostgreSQL golden master
                (ELT &amp; Data Fabric mapped as scale options)
              </span>
            </div>
          </div>
        </section>

        <div className="flowchart-connector" aria-hidden="true">
          <span className="flowchart-connector-label">Scoped views</span>
          <ArrowRight size={18} />
        </div>

        <section className="flowchart-column" aria-label="Governed outputs">
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
          Trusted &amp; governed master warehouse powers downstream intelligence
        </span>
      </div>

      <div
        className="flowchart-downstream"
        aria-label="Downstream intelligence and readiness"
      >
        <div className="flowchart-node is-downstream">
          <div className="flowchart-node-head">
            <ChartNoAxesCombined size={15} />
            <strong>Academic Analytics &amp; BI</strong>
          </div>
          <span>GWA (1.00–5.00) bands, program averages &amp; warning radar</span>
        </div>
        <div className="flowchart-node is-downstream">
          <div className="flowchart-node-head">
            <Sparkles size={15} />
            <strong>AI &amp; ML Readiness</strong>
          </div>
          <span>
            Validated, deduplicated master records ready for future predictive
            models
          </span>
        </div>
        <div className="flowchart-node is-downstream">
          <div className="flowchart-node-head">
            <ShieldCheck size={15} />
            <strong>Compliance &amp; Auditability</strong>
          </div>
          <span>Verifiable hash chain &amp; role-governed exports</span>
        </div>
      </div>
    </div>
  );
}
