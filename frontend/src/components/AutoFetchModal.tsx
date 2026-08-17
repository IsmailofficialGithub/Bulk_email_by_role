"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import type { AutoFetchConfig, AutoCommentConfig, Role } from "@/lib/types";
import { ROLE_LABELS, ROLES } from "@/lib/types";
import { HelpTooltip } from "./HelpTooltip";

type Props = {
  config: AutoFetchConfig;
  autoCommentConfig: AutoCommentConfig;
  onSave: (newConfig: AutoFetchConfig, newCommentConfig: AutoCommentConfig) => void;
  onClose: () => void;
};

type KeywordMapping = { keyword: string, role: Role };

export function AutoFetchModal({ config, autoCommentConfig, onSave, onClose }: Props) {
  const [enabled, setEnabled] = useState(config.enabled);
  
  const [keywordMappings, setKeywordMappings] = useState<KeywordMapping[]>(() => {
    try {
      const parsed = JSON.parse(config.keywords);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    if (config.keywords.trim()) {
      return config.keywords.split(",").map(k => ({
        keyword: k.trim(),
        role: config.targetRole || "fullstack"
      }));
    }
    return [];
  });

  const [newKeyword, setNewKeyword] = useState("");
  const [newRole, setNewRole] = useState<Role>("fullstack");

  const [intervalMin, setIntervalMin] = useState(config.intervalMin || 180);
  const [paginationLimit, setPaginationLimit] = useState(config.paginationLimit || 3);
  const [paginationDelaySec, setPaginationDelaySec] = useState(config.paginationDelaySec || 10);
  const [postAgeFilter, setPostAgeFilter] = useState<AutoFetchConfig["postAgeFilter"]>(config.postAgeFilter || "any");

  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasKeywords = keywordMappings.length > 0;

  // Basic validation to enable
  const canEnable = Boolean(hasKeywords && config.liAt && config.jsessionid && config.rawHeaders);

  async function handleSave() {
    const finalEnabled = enabled && canEnable;
    const finalInterval = Math.max(180, intervalMin || 180);

    onSave({
      ...config,
      enabled: finalEnabled,
      keywords: JSON.stringify(keywordMappings),
      targetRole: keywordMappings.length > 0 ? keywordMappings[0].role : "fullstack",
      intervalMin: finalInterval,
      paginationLimit: Math.max(3, paginationLimit || 3),
      paginationDelaySec: Math.max(1, paginationDelaySec || 10),
      postAgeFilter,
    }, autoCommentConfig);
    
    toast.success("Auto-fetch configuration saved!");
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="modal-backdrop" role="presentation" onClick={onClose} style={{ zIndex: 99999 }}>
        <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <h2>LinkedIn Scraper Settings</h2>
              <p className="hint compact">Configure background lead scraping parameters.</p>
            </div>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          </div>

          <div className="modal-body" style={{ overflowY: 'auto' }}>
            <label className="field">
              <span>
                Enable Auto-Fetch
                {!canEnable && (
                  <span className="hint" style={{ marginLeft: "0.5rem", color: "var(--err)" }}>
                    (Requires Keywords & LinkedIn Configuration)
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

            <div className="grid-2" style={{ border: "1px solid var(--line)", padding: "1rem", borderRadius: "8px", background: "var(--bg)" }}>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>
                  Keyword to Role Mappings
                  <HelpTooltip 
                    title="Search Keywords" 
                    content={
                      <>
                        <p>Add search keywords and map them to a specific email template category.</p>
                        <p>The scraper will search LinkedIn for each keyword individually, and automatically assign the selected Role to the extracted leads!</p>
                      </>
                    } 
                  />
                </span>
              </label>
              
              <div style={{ display: "flex", gap: "0.5rem", gridColumn: "1 / -1", alignItems: "flex-end" }}>
                <div style={{ flex: 2 }}>
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="e.g. software engineer"
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--fg)" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--fg)" }}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <button 
                  className="btn filled" 
                  type="button"
                  onClick={() => {
                    if (newKeyword.trim()) {
                      if (keywordMappings.length >= 3) {
                        toast.error("You can only add up to 3 keywords.");
                        return;
                      }
                      setKeywordMappings([...keywordMappings, { keyword: newKeyword.trim(), role: newRole }]);
                      setNewKeyword("");
                    }
                  }}
                >
                  Add
                </button>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                {keywordMappings.length === 0 ? (
                  <div style={{ padding: "0.5rem", textAlign: "center", color: "var(--muted)", fontStyle: "italic", fontSize: "0.9rem" }}>
                    No keywords added. Add at least one to enable auto-fetch.
                  </div>
                ) : (
                  keywordMappings.map((map, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "var(--bg-panel)", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "0.9rem" }}>
                      <div>
                        <strong>{map.keyword}</strong>
                        <span style={{ margin: "0 0.5rem", color: "var(--muted)" }}>→</span>
                        <span style={{ color: "var(--accent)" }}>{ROLE_LABELS[map.role]} Template</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setKeywordMappings(keywordMappings.filter((_, i) => i !== idx))}
                        style={{ background: "transparent", border: "none", color: "var(--err)", cursor: "pointer", fontSize: "0.85rem", padding: "0.25rem" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid-2">
              <label className="field">
                <span>
                  Run interval (minutes)
                  <HelpTooltip 
                    title="Fetch Interval" 
                    content={
                      <>
                        <p>How often should the background worker wake up and search LinkedIn for new posts?</p>
                        <p><strong>Recommendation:</strong> Set this to <strong>5 or 10 minutes</strong>. If you set it too low (like 1 minute), LinkedIn might temporarily block your account for searching too quickly.</p>
                      </>
                    } 
                  />
                </span>
                <input
                  type="number"
                  min={180}
                  max={1440}
                  value={intervalMin}
                  onChange={(e) => setIntervalMin(Number(e.target.value) || 180)}
                />
              </label>

              <label className="field">
                <span>
                  Pagination Limit
                  <HelpTooltip 
                    title="Pagination Limit" 
                    content={
                      <>
                        <p>How many pages of search results should the scraper look through during each interval?</p>
                        <p>If set to <strong>3</strong>, it will scrape Page 1, Page 2, and Page 3 of the LinkedIn search results.</p>
                      </>
                    } 
                  />
                </span>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={paginationLimit}
                  onChange={(e) => setPaginationLimit(Number(e.target.value) || 3)}
                />
              </label>
            </div>

            <div className="grid-2">
              <label className="field">
                <span>
                  Pagination Delay (Sec)
                  <HelpTooltip 
                    title="Pagination Delay" 
                    content={
                      <>
                        <p>The amount of time (in seconds) to pause between scraping each page.</p>
                        <p>This is a safety measure to mimic human browsing behavior and prevent LinkedIn from detecting the scraper. <strong>10 to 15 seconds</strong> is highly recommended.</p>
                      </>
                    } 
                  />
                </span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={paginationDelaySec}
                  onChange={(e) => setPaginationDelaySec(Number(e.target.value) || 10)}
                />
              </label>
            </div>

            <label className="field" style={{ marginTop: "0.5rem" }}>
              <span>
                Post Age Filter
                <HelpTooltip 
                  title="Post Age Filter" 
                  content={
                    <>
                      <p>Only scrape LinkedIn posts published within this timeframe.</p>
                      <p><strong>Past 24 hours</strong> ensures you are only reaching out to fresh, active leads who just posted recently!</p>
                    </>
                  } 
                />
              </span>
              <select
                value={postAgeFilter}
                onChange={(e) => setPostAgeFilter(e.target.value as any)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--fg)" }}
              >
                <option value="24h">Past 24 hours (Recommended)</option>
                <option value="1w">Past 1 week</option>
                <option value="1m">Past 1 month</option>
                <option value="all">Any time</option>
              </select>
            </label>
          </div>
          
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn primary large"
              onClick={handleSave}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
