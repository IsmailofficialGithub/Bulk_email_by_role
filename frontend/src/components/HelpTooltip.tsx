"use client";

import { useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  content: ReactNode;
};

export function HelpTooltip({ title, content }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <button
        type="button"
        className="help-tooltip-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        title={`Help for ${title}`}
      >
        ?
      </button>

      {isOpen && mounted && createPortal(
        <div className="modal-backdrop" onClick={() => setIsOpen(false)} style={{ zIndex: 9999999, background: "color-mix(in srgb, var(--bg) 75%, transparent)" }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
            <div className="modal-head">
              <div>
                <h2>{title}</h2>
              </div>
              <button type="button" className="btn ghost" onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body stack" style={{ lineHeight: "1.6" }}>
              {content}
            </div>
            
            <hr style={{ border: "0", borderTop: "1px solid var(--line)", margin: "1rem 0" }} />
            
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn primary" onClick={() => setIsOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
