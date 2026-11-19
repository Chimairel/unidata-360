"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// Adapted from the supplied 21st.dev MercuryLogin demo. Fixed positions keep
// server and client markup identical; authentication remains in SignIn.
const blobs = [
  { width: "45%", height: "52%", left: "8%", top: "26%" },
  { width: "42%", height: "48%", left: "39%", top: "10%" },
  { width: "40%", height: "50%", left: "60%", top: "29%" },
  { width: "38%", height: "45%", left: "29%", top: "49%" },
  { width: "30%", height: "33%", left: "53%", top: "60%" },
  { width: "24%", height: "28%", left: "16%", top: "55%" },
];

export function NeuralAccessLogin({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const filterId = `mercury-${useId().replaceAll(":", "")}`;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty(
          "--mercury-x",
          `${(event.clientX / innerWidth - 0.5) * 24}px`,
        );
        element.style.setProperty(
          "--mercury-y",
          `${(event.clientY / innerHeight - 0.5) * 18}px`,
        );
      });
    };
    element.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", move);
    };
  }, []);

  return (
    <div ref={root} className="account-page neural-access-page">
      <LiquidFilter id={filterId} />
      <div className="neural-stage" aria-hidden="true">
        <div className="neural-liquid" style={{ filter: `url(#${filterId})` }}>
          {blobs.map((style, index) => (
            <div key={index} className="neural-blob" style={style} />
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

function LiquidFilter({ id }: { id: string }) {
  return (
    <svg className="neural-filter" aria-hidden="true" focusable="false">
      <defs>
        <filter id={id} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}

export function NeuralSubmit({ children }: { children: ReactNode }) {
  const id = `mercury-submit-${useId().replaceAll(":", "")}`;
  return (
    <div className="neural-submit-wrap">
      <LiquidFilter id={id} />
      <div className="neural-submit-liquid" style={{ filter: `url(#${id})` }}>
        <div className="neural-submit-drop" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
