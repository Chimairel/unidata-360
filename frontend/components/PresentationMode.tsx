"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  StickyNote,
  X,
  ArrowRight,
} from "lucide-react";
import { slides, industryMatrix } from "@/frontend/lib/presentation";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { Badge } from "./ui";
export function PresentationMode({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState(false);
  const [full, setFull] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const { sourceCounts, masterRecords } = useEDM();
  const slide = slides[index];
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const changed = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", changed);
    return () => {
      dialog?.close();
      document.removeEventListener("fullscreenchange", changed);
    };
  }, []);
  const next = () => setIndex((i) => Math.min(slides.length - 1, i + 1));
  const previous = () => setIndex((i) => Math.max(0, i - 1));
  const close = async () => {
    if (document.fullscreenElement)
      await document.exitFullscreen().catch(() => {});
    onClose();
  };
  return (
    <dialog
      ref={ref}
      className="modal presentation"
      aria-label="EDM classroom presentation"
      onCancel={(e) => {
        e.preventDefault();
        void close();
      }}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLSelectElement) return;
        if (e.key === "ArrowRight" || e.key === "PageDown") {
          e.preventDefault();
          next();
        }
        if (e.key === "ArrowLeft" || e.key === "PageUp") {
          e.preventDefault();
          previous();
        }
        if (e.key === "Home") {
          e.preventDefault();
          setIndex(0);
        }
        if (e.key === "End") {
          e.preventDefault();
          setIndex(slides.length - 1);
        }
      }}
    >
      <div className="modal-heading">
        <div className="presentation-heading">
          <h2>UniData 360</h2>
          <Badge>EDM · Education / Universities</Badge>
        </div>
        <div className="presentation-tools">
          <button
            className="button quiet"
            aria-pressed={notes}
            aria-label="Speaker notes"
            onClick={() => setNotes(!notes)}
          >
            <StickyNote size={15} />
            Speaker notes
          </button>
          <button
            className="button quiet"
            onClick={async () => {
              // Fullscreen remains optional; the dialog is usable if denied.
              try {
                setFullscreenError("");
                if (full) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {
                setFullscreenError(
                  "Fullscreen is unavailable in this browser. The slide viewer remains usable.",
                );
              }
            }}
          >
            {full ? <Minimize size={15} /> : <Maximize size={15} />}{" "}
            {full ? "Exit fullscreen" : "Fullscreen"}
          </button>
          <button
            className="icon-button"
            aria-label="Close presentation"
            onClick={() => void close()}
          >
            <X size={20} />
          </button>
        </div>
      </div>
      <article className="slide" key={index} aria-live="polite">
        <h2>{slide.title}</h2>
        <p className="slide-intro">{slide.intro}</p>
        {index === 0 && (
          <div className="lifecycle-line" style={{ marginBottom: 25 }}>
            <span>Sources</span>
            <ArrowRight size={20} />
            <span>Integration</span>
            <ArrowRight size={20} />
            <span>Governance</span>
            <ArrowRight size={20} />
            <span>Outputs</span>
          </div>
        )}
        {index === 6 ? (
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
                  <tr
                    key={row[0]}
                    className={i === 4 ? "matrix-highlight" : ""}
                  >
                    {row.map((cell, j) => (
                      <td key={j}>
                        {j === 0 ? <strong>{cell}</strong> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="slide-content">
            {slide.items.map(([title, body]) => (
              <section className="slide-item" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </section>
            ))}
          </div>
        )}
        {index === 0 && (
          <p className="small" style={{ marginTop: 20 }}>
            Current permitted snapshot: {sourceCounts.SIS} SIS rows ·{" "}
            {sourceCounts.LMS} LMS rows · {sourceCounts.LIBRARY} Library rows ·{" "}
            {masterRecords.length} master students. Synthetic demonstration
            data.
          </p>
        )}
      </article>
      {fullscreenError && (
        <p
          className="small text-warning"
          role="status"
          style={{ padding: "8px 24px" }}
        >
          {fullscreenError}
        </p>
      )}
      {notes && (
        <aside className="speaker-notes">
          <strong>Speaker notes</strong>
          <p style={{ marginTop: 5 }}>{slide.notes}</p>
        </aside>
      )}
      <div className="slide-footer">
        <label className="slide-progress">
          Slide{" "}
          <select
            aria-label="Jump to slide"
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            style={{ minHeight: 32, padding: "4px 8px", margin: "0 6px" }}
          >
            {slides.map((s, i) => (
              <option value={i} key={s.title}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>{" "}
          of {slides.length}
        </label>
        <div className="slide-list">
          {slides.map((s, i) => (
            <button
              key={s.title}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? "step" : undefined}
              className={`slide-dot ${i === index ? "active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <div className="slide-navigation">
          <button
            className="button secondary"
            aria-label="Previous slide"
            disabled={index === 0}
            onClick={previous}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="slide-progress">← → keys</span>
          <button
            className="button primary"
            aria-label="Next slide"
            disabled={index === slides.length - 1}
            onClick={next}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
