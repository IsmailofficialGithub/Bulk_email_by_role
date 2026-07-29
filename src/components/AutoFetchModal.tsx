"use client";

import { useState } from "react";
import type { AutoFetchConfig } from "@/lib/types";

type Props = {
  config: AutoFetchConfig;
  onSave: (newConfig: AutoFetchConfig) => void;
  onClose: () => void;
};

export function AutoFetchModal({ config, onSave, onClose }: Props) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [keywords, setKeywords] = useState(config.keywords);
  const [intervalMin, setIntervalMin] = useState(config.intervalMin);
  const [liAt, setLiAt] = useState(config.liAt);
  const [jsessionid, setJsessionid] = useState(config.jsessionid || "ajax:");
  const [showTokens, setShowTokens] = useState(false);

  // Regex validation
  const isJsessionValid = jsessionid === "" || /^ajax:\d+$/.test(jsessionid);
  const isLiAtValid = liAt === "" || /^[a-zA-Z0-9_-]{20,}$/.test(liAt);

  const hasKeywords = keywords.trim().length > 0;

  // Validate before enabling
  const canEnable = 
    liAt.trim().length > 0 && 
    jsessionid.trim().length > 0 && 
    isJsessionValid && 
    isLiAtValid &&
    hasKeywords;

  function handleSave() {
    // Force disable if tokens are missing when saving
    const finalEnabled = enabled && canEnable;
    // Enforce minimum interval
    const finalInterval = Math.max(5, intervalMin || 5);

    onSave({
      enabled: finalEnabled,
      keywords,
      intervalMin: finalInterval,
      liAt: liAt.trim(),
      jsessionid: jsessionid.trim(),
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="autofetch-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="autofetch-modal-title">LinkedIn Auto-Fetch Setup</h2>
            <p className="hint compact">
              Background workers will automatically fetch emails based on keywords.
            </p>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>
              Enable Auto-Fetch
              {!canEnable && (
                <span className="hint" style={{ marginLeft: "0.5rem", color: "var(--err)" }}>
                  (Requires Cookies & Keywords)
                </span>
              )}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={!canEnable}
                style={{ width: "1.2rem", height: "1.2rem" }}
              />
              <span style={{ fontSize: "0.85rem", color: enabled ? "var(--ok)" : "var(--muted)" }}>
                {enabled ? "Active" : "Inactive"}
              </span>
            </div>
          </label>

          <div className="grid-2">
            <label className="field">
              <span>Keywords (comma separated)</span>
              <input
                type="text"
                value={keywords}
                onChange={(e) => {
                  setKeywords(e.target.value);
                  if (!e.target.value.trim() && enabled) setEnabled(false);
                }}
                placeholder="e.g. software engineer, founder"
              />
            </label>
            <label className="field">
              <span>Interval (Minutes)</span>
              <input
                type="number"
                min={5}
                step={1}
                value={intervalMin}
                onChange={(e) => setIntervalMin(Number(e.target.value))}
                placeholder="Minimum 5"
              />
            </label>
          </div>

          <hr style={{ border: "0", borderTop: "1px solid var(--line)", margin: "0.5rem 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.5rem 0" }}>LinkedIn Cookies</h3>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setShowTokens(!showTokens)}
              style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
            >
              {showTokens ? "Hide" : "Show"} Values
            </button>
          </div>

          <div className="grid-2">
            <label className="field">
              <span>
                li_at
                {!isLiAtValid && liAt.length > 0 && (
                  <span className="hint" style={{ marginLeft: "0.5rem", color: "var(--err)" }}>
                    (Invalid format)
                  </span>
                )}
              </span>
              <input
                type={showTokens ? "text" : "password"}
                value={liAt}
                onChange={(e) => {
                  setLiAt(e.target.value);
                  if (!e.target.value.trim() && enabled) setEnabled(false);
                }}
                style={{ borderColor: !isLiAtValid && liAt.length > 0 ? "var(--err)" : undefined }}
                placeholder="AQ..."
              />
            </label>
            <label className="field">
              <span>
                JSESSIONID
                {!isJsessionValid && jsessionid !== "ajax:" && jsessionid.length > 0 && (
                  <span className="hint" style={{ marginLeft: "0.5rem", color: "var(--err)" }}>
                    (Should be ajax: + digits)
                  </span>
                )}
              </span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span 
                  style={{ 
                    position: "absolute", 
                    left: "0.75rem", 
                    color: "var(--fg)", 
                    pointerEvents: "none",
                    fontFamily: "monospace",
                    fontSize: "0.9rem"
                  }}
                >
                  ajax:
                </span>
                <input
                  type={showTokens ? "text" : "password"}
                  value={jsessionid.replace(/^ajax:/, '')}
                  onChange={(e) => {
                    let val = e.target.value.replace(/^ajax:/, '');
                    setJsessionid("ajax:" + val);
                    if (!val.trim() && enabled) setEnabled(false);
                  }}
                  style={{ 
                    borderColor: !isJsessionValid && jsessionid !== "ajax:" && jsessionid.length > 0 ? "var(--err)" : undefined,
                    paddingLeft: "3.2rem" 
                  }}
                  placeholder="***"
                />
              </div>
            </label>
          </div>

          <button
            type="button"
            className="btn primary large"
            onClick={handleSave}
            style={{ marginTop: "0.5rem" }}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
