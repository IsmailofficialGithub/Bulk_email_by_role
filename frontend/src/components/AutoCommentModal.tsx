"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { AutoCommentConfig, AutoFetchConfig } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

type Props = {
  config: AutoCommentConfig;
  linkedinConnected: boolean;
  autoFetchConfig: AutoFetchConfig;
  onSave: (config: AutoCommentConfig) => void;
  onClose: () => void;
  onLinkedinConnectedChange: (connected: boolean) => void;
};

export function AutoCommentModal({ config, linkedinConnected, autoFetchConfig, onSave, onClose, onLinkedinConnectedChange }: Props) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [dailyLimit, setDailyLimit] = useState(config.dailyLimit);
  const [intervalMin, setIntervalMin] = useState(config.intervalMin);
  const [aiPrompt, setAiPrompt] = useState(config.aiPrompt);
  const [keywords, setKeywords] = useState(config.keywords || "");
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Validation logic
  const hasCookies = !!(autoFetchConfig.liAt && autoFetchConfig.jsessionid);
  const hasPrompt = !!aiPrompt.trim();
  const validLimits = dailyLimit > 0 && intervalMin > 0;
  
  const canEnable = linkedinConnected && hasCookies && hasPrompt && validLimits;

  function handleSave() {
    onSave({
      enabled: canEnable ? enabled : false,
      dailyLimit,
      intervalMin,
      aiPrompt,
      keywords,
    });
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="autocomment-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="autocomment-modal-title">LinkedIn Auto-Comment Config</h2>
            <p className="hint compact">
              Configure your AI automated comments. The background worker will automatically comment on posts from your scraped leads.
            </p>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="modal-body">

          <label className="field">
            <span>
              Enable Auto Commenting
              {!canEnable && (
                <span className="hint" style={{ marginLeft: "0.5rem", color: "var(--err)" }}>
                  (Requires Cookies & Valid Settings)
                </span>
              )}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <input
                type="checkbox"
                checked={canEnable ? enabled : false}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={!canEnable}
                style={{ width: "1.2rem", height: "1.2rem" }}
              />
              <span style={{ fontSize: "0.85rem", color: canEnable && enabled ? "var(--ok)" : "var(--muted)" }}>
                {canEnable && enabled ? "Active" : "Inactive"}
              </span>
            </div>
          </label>

          <div className="grid-2">
            <label className="field">
              <span>Daily Comment Limit</span>
              <input
                type="number"
                min="1"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
              />
            </label>
            <label className="field">
              <span>Interval Between Comments (minutes)</span>
              <input
                type="number"
                min="1"
                value={intervalMin}
                onChange={(e) => setIntervalMin(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </label>
          </div>

          <label className="field" style={{ marginTop: '1rem' }}>
            <span>Target Keywords (Optional, comma-separated)</span>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. software engineer, hiring, next.js"
            />
            <span className="hint compact">Leave empty to comment on your home feed.</span>
          </label>

          <label className="field" style={{ marginTop: '1rem' }}>
            <span>AI Prompt (Context: {"{post_text}"} will be replaced with the actual post)</span>
            <textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. You are an insightful professional on LinkedIn. Write a short, encouraging comment for this post: {{post_text}}"
            />
          </label>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>Prerequisites Check</h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <li style={{ color: linkedinConnected ? 'var(--accent)' : 'var(--err)' }}>
                {linkedinConnected ? '✓ LinkedIn OAuth Connected' : '✗ LinkedIn OAuth Not Connected (Connect in settings)'}
              </li>
              <li style={{ color: hasCookies ? 'var(--accent)' : 'var(--err)' }}>
                {hasCookies ? '✓ LinkedIn Cookies (li_at / jsessionid) Set in Auto-Fetch Config' : '✗ LinkedIn Cookies Missing (Set them in the Auto-Fetch Config)'}
              </li>
              <li style={{ color: hasPrompt ? 'var(--accent)' : 'var(--err)' }}>
                {hasPrompt ? '✓ AI Prompt Configured' : '✗ AI Prompt Missing'}
              </li>
              <li style={{ color: validLimits ? 'var(--accent)' : 'var(--err)' }}>
                {validLimits ? '✓ Limits Configured' : '✗ Limits must be > 0'}
              </li>
            </ul>
          </div>
          
          <button
            type="button"
            className="btn primary large"
            onClick={handleSave}
            style={{ marginTop: "1rem", width: "100%" }}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
