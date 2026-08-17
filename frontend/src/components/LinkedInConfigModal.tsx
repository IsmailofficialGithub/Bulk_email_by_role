"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import type { AutoFetchConfig, AutoCommentConfig } from "@/lib/types";
import { HelpTooltip } from "./HelpTooltip";
import { CookieHelpModal } from "./CookieHelpModal";

type Props = {
  config: AutoFetchConfig;
  autoCommentConfig: AutoCommentConfig;
  linkedinConnected: boolean;
  identityMatch: { match: boolean | null, message?: string };
  onSave: (newConfig: AutoFetchConfig, newCommentConfig: AutoCommentConfig) => void;
  onClose: () => void;
  onLinkedinConnectedChange: (connected: boolean) => void;
};

export function LinkedInConfigModal({ config, autoCommentConfig, linkedinConnected, identityMatch, onSave, onClose, onLinkedinConnectedChange }: Props) {
  // Auto Comment States
  const [commentEnabled, setCommentEnabled] = useState(autoCommentConfig.enabled);
  const [commentDailyLimit, setCommentDailyLimit] = useState(autoCommentConfig.dailyLimit);
  const [commentIntervalMin, setCommentIntervalMin] = useState(autoCommentConfig.intervalMin);
  const [commentAiPrompt, setCommentAiPrompt] = useState(autoCommentConfig.aiPrompt);
  const [commentKeywords, setCommentKeywords] = useState(autoCommentConfig.keywords || "");
  
  // Cookie States
  const [liAt, setLiAt] = useState(config.liAt);
  const [jsessionid, setJsessionid] = useState(config.jsessionid || "ajax:");
  const [rawHeaders, setRawHeaders] = useState(config.rawHeaders || "{}");
  
  const [showTokens, setShowTokens] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  const [manualKey, setManualKey] = useState<string>("");
  const [manualValue, setManualValue] = useState<string>("");

  const [mounted, setMounted] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    const checkExtension = () => {
      const hasMarker = document.querySelector('meta[name="automail-extension-installed"]');
      if (hasMarker) setExtensionInstalled(true);
    };
    checkExtension();
    const interval = setInterval(checkExtension, 1000);
    return () => clearInterval(interval);
  }, []);

  const isJsessionValid = jsessionid === "" || /^ajax:\d+$/.test(jsessionid);
  const isLiAtValid = liAt === "" || /^[a-zA-Z0-9_-]{20,}$/.test(liAt);

  let parsedHeaders: Record<string, string> | null = null;
  try {
    if (rawHeaders.trim().startsWith('{')) {
      parsedHeaders = JSON.parse(rawHeaders);
      const keys = Object.keys(parsedHeaders!).map(k => k.toLowerCase());
      if (!keys.includes('csrf-token') && jsessionid && jsessionid !== "ajax:") {
         parsedHeaders!['csrf-token'] = jsessionid.trim().replace(/"/g, '');
      }
    }
  } catch {}

  const REQUIRED_HEADERS = ["Cookie", "Accept", "Content-Type", "Origin", "Referer", "User-Agent", "csrf-token", "x-restli-protocol-version"];
  let missingHeaders: string[] = [];
  if (parsedHeaders) {
    const keys = Object.keys(parsedHeaders).map(k => k.toLowerCase());
    missingHeaders = REQUIRED_HEADERS.filter(h => !keys.includes(h.toLowerCase()));
  } else {
    missingHeaders = [...REQUIRED_HEADERS];
  }

  const hasAllHeaders = missingHeaders.length === 0;

  async function handleSave() {
    if (liAt.trim().length > 0 && jsessionid.trim().length > 0 && hasAllHeaders) {
      setIsVerifying(true);
      try {
        const res = await fetch("/api/verify-linkedin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liAt: liAt.trim(),
            jsessionid: jsessionid.trim(),
            rawHeaders,
          }),
        });
        
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error(data.error || "LinkedIn validation failed");
          setIsVerifying(false);
          return;
        }
      } catch {
        toast.error("Network error validating cookies");
        setIsVerifying(false);
        return;
      }
      setIsVerifying(false);
    }

    let finalRawHeaders = rawHeaders;
    try {
      if (rawHeaders.trim().startsWith('{')) {
        const parsed = JSON.parse(rawHeaders);
        const sanitized: Record<string, string> = {};
        const allowedKeys = REQUIRED_HEADERS.map(h => h.toLowerCase());
        for (const [k, v] of Object.entries(parsed)) {
          const lowerK = k.toLowerCase();
          if (allowedKeys.includes(lowerK)) {
            const properKey = REQUIRED_HEADERS.find(r => r.toLowerCase() === lowerK) || k;
            sanitized[properKey] = v as string;
          }
        }
        finalRawHeaders = JSON.stringify(sanitized, null, 2);
      }
    } catch {}

    onSave({
      ...config,
      liAt: liAt.trim(),
      jsessionid: jsessionid.trim(),
      rawHeaders: finalRawHeaders,
    }, {
      enabled: commentEnabled,
      dailyLimit: commentDailyLimit,
      intervalMin: Math.max(1, commentIntervalMin),
      aiPrompt: commentAiPrompt,
      keywords: commentKeywords.trim(),
    });
    
    toast.success("LinkedIn Configuration saved!");
    onClose();
  }

  function handleAutoDetect() {
    const isInstalledNow = !!document.querySelector('meta[name="automail-extension-installed"]');
    if (isInstalledNow && !extensionInstalled) setExtensionInstalled(true);
    
    if (!isInstalledNow) {
      toast.error("Extension not detected. Please install the Automail LinkedIn Cookie Extractor first.");
      return;
    }
    
    const handleResponse = (e: any) => {
      window.removeEventListener("AUTOMAILEXT_RECEIVE_COOKIE", handleResponse);
      const data = e.detail;
      if (data && data.success && data.jsessionid && data.li_at) {
        const cleanJsession = data.jsessionid.startsWith('ajax:') ? data.jsessionid : `ajax:${data.jsessionid}`;
        setJsessionid(cleanJsession);
        setLiAt(data.li_at);
        const perfectHeaders = {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Origin": "https://www.linkedin.com",
          "Referer": "https://www.linkedin.com/preload/?_bprMode=vanilla",
          "User-Agent": navigator.userAgent,
          "x-restli-protocol-version": "2.0.0",
          "csrf-token": cleanJsession,
          "Cookie": `li_at=${data.li_at}; JSESSIONID="${cleanJsession}";`
        };
        setRawHeaders(JSON.stringify(perfectHeaders, null, 2));
        if (data.username && data.username !== "LinkedIn User") {
          toast.success(`Welcome, ${data.username}! Tokens extracted.`);
        } else {
          toast.success("Successfully extracted ALL LinkedIn tokens!");
        }
      } else {
        toast.error(data?.error || "Failed to detect cookies. Make sure you are logged into LinkedIn.");
      }
    };
    window.addEventListener("AUTOMAILEXT_RECEIVE_COOKIE", handleResponse);
    window.dispatchEvent(new CustomEvent("AUTOMAILEXT_REQUEST_COOKIE"));
  }

  function handleSmartPaste(val: string) {
    let extracted = 0;
    function parseCustom(text: string) {
      const trimmed = text.trim();
      if (!trimmed) return null;
      try {
        if (trimmed.startsWith('{')) return JSON.parse(trimmed);
      } catch {}
      const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const res: Record<string, string> = {};
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if ((line.includes('li_at=') || line.includes('JSESSIONID=')) && !line.includes(': ')) {
          res['Cookie'] = line; i++; continue;
        }
        if (line.includes(': ')) {
          const idx = line.indexOf(': ');
          res[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
          i++; continue;
        }
        if (i + 1 < lines.length) {
          res[line] = lines[i + 1]; i += 2;
        } else {
          i++;
        }
      }
      const keys = Object.keys(res).map(k => k.toLowerCase());
      if (!keys.includes('csrf-token') && res['Cookie']) {
        const match = res['Cookie'].match(/ajax:\d+/);
        if (match) res['csrf-token'] = match[0];
      }
      return Object.keys(res).length > 0 ? res : null;
    }
    const parsed = parseCustom(val);
    if (parsed) {
      const sanitized: Record<string, string> = {};
      const allowedKeys = REQUIRED_HEADERS.map(h => h.toLowerCase());
      for (const [k, v] of Object.entries(parsed)) {
        const lowerK = k.toLowerCase();
        if (allowedKeys.includes(lowerK)) {
          const properKey = REQUIRED_HEADERS.find(r => r.toLowerCase() === lowerK) || k;
          sanitized[properKey] = v as string;
        }
      }
      setRawHeaders(JSON.stringify(sanitized, null, 2));
    } else {
      setRawHeaders(val);
    }
    const jsessionMatch = val.match(/ajax:\d+/);
    if (jsessionMatch) {
      setJsessionid(jsessionMatch[0]); extracted++;
    }
    const liAtMatch = val.match(/li_at=([^;"\s]+)/);
    if (liAtMatch) {
      setLiAt(liAtMatch[1]); extracted++;
    }
    if (extracted > 0) {
      toast.success(`Auto-extracted ${extracted} token(s)!`);
    } else if (val.trim().length > 0) {
      toast.error("No valid tokens found in pasted text.");
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="modal-backdrop" role="presentation" onClick={onClose} style={{ zIndex: 99999 }}>
        <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <h2>LinkedIn Configuration</h2>
              <p className="hint compact">Manage LinkedIn connection, cookies, and auto-commenting.</p>
            </div>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          </div>

          <div className="modal-body" style={{ overflowY: 'auto' }}>
            {identityMatch.match === false && (
              <div style={{ padding: '1rem', background: 'color-mix(in srgb, var(--err) 10%, transparent)', border: '1px solid var(--err)', borderRadius: '8px', color: 'var(--err)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <strong>Identity Mismatch Warning:</strong>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{identityMatch.message}</div>
                  <div style={{ fontSize: '0.85rem' }}>Please ensure you are connected to the exact same LinkedIn account in both OAuth and your browser Extension Cookies to avoid commenting errors.</div>
                </div>
              </div>
            )}

            <h3 style={{ margin: "0 0 0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.25rem" }}>1. Browser Cookies (Required for Scraper)</h3>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "0 0 0.5rem 0" }}>
                <h3 style={{ fontSize: "0.85rem", margin: 0, display: "flex", alignItems: "center" }}>
                  LinkedIn Cookies
                  <HelpTooltip 
                    title="LinkedIn Cookies" 
                    content={
                      <>
                        <p>To search LinkedIn automatically, the background worker needs your temporary session credentials (called "Cookies").</p>
                        <p>We do not store your LinkedIn password.</p>
                      </>
                    } 
                  />
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowHelpModal(true)}
                  className="btn small ghost" 
                  style={{ padding: "0.1rem 0.5rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--ok)", borderColor: "var(--ok)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  How to set cookies?
                </button>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowTokens(!showTokens)}
                style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
              >
                {showTokens ? "Hide" : "Show"} Values
              </button>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem", gap: "0.5rem" }}>
              {!extensionInstalled && (
                <a 
                  href="data:application/zip;base64,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" 
                  download="automail-extension.zip"
                  className="btn small ghost"
                  style={{ display: "flex", gap: "0.5rem", alignItems: "center", border: "1px solid var(--line)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  Download Extension (.zip)
                </a>
              )}
              <button
                type="button"
                className="btn small"
                style={{ background: extensionInstalled ? "var(--bg-accent)" : "var(--bg-elevated)", display: "flex", gap: "0.5rem", alignItems: "center" }}
                onClick={handleAutoDetect}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                Auto-Detect JSESSIONID
              </button>
            </div>

            <label className="field" style={{ marginBottom: "1rem" }}>
              <span className="hint compact" style={{ marginBottom: "0.25rem" }}>
                <strong>Smart Paste:</strong> Paste raw headers or cookie string here to auto-fill
              </span>
              <textarea
                rows={4}
                style={{ fontSize: "0.8rem", fontFamily: "monospace", width: "100%", padding: "0.5rem" }}
                placeholder='e.g. {"Cookie": "...", "csrf-token": "..."}'
                value={rawHeaders}
                onChange={(e) => handleSmartPaste(e.target.value)}
              />
              {parsedHeaders && Object.keys(parsedHeaders).length > 0 && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", background: "var(--bg-card)", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--line)", maxHeight: "250px", overflowY: "auto" }}>
                  <strong style={{ display: "block", marginBottom: "0.25rem", color: "var(--ok)" }}>✅ Extracted Headers:</strong>
                  {Object.entries(parsedHeaders).map(([key, value]) => (
                    <div key={key} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: "bold", minWidth: "120px", color: "var(--fg)" }}>{key}:</span>
                      <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value as string}>
                        {value as string}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!parsedHeaders && (liAt || (jsessionid && jsessionid !== "ajax:")) && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {liAt && liAt.length > 0 && (
                    <span className="badge ok" style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}>✅ li_at</span>
                  )}
                  {jsessionid && jsessionid !== "ajax:" && jsessionid.length > 0 && (
                    <span className="badge ok" style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}>✅ JSESSIONID</span>
                  )}
                </div>
              )}
              {missingHeaders.length > 0 && rawHeaders.trim().length > 0 && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--err)", padding: "0.5rem", background: "rgba(255,0,0,0.1)", borderRadius: "4px" }}>
                  <strong>❌ Missing required headers:</strong><br />
                  {missingHeaders.join(", ")}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" }}>
                    <select 
                      value={manualKey || missingHeaders[0]} 
                      onChange={(e) => setManualKey(e.target.value)}
                      style={{ flex: "1 1 120px", padding: "0.3rem", borderRadius: "4px", border: "1px solid var(--err)", background: "var(--bg)", color: "var(--fg)" }}
                    >
                      {missingHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <input 
                      type="text" 
                      placeholder="Value..." 
                      value={manualValue} 
                      onChange={(e) => setManualValue(e.target.value)} 
                      style={{ flex: "2 1 150px", minWidth: 0, padding: "0.3rem", borderRadius: "4px", border: "1px solid var(--err)", background: "var(--bg)", color: "var(--fg)" }}
                    />
                    <button 
                      type="button" 
                      className="btn primary small"
                      style={{ padding: "0.3rem 0.75rem" }}
                      onClick={() => {
                        const keyToAdd = manualKey || missingHeaders[0];
                        if (!manualValue.trim()) { toast.error("Value cannot be empty"); return; }
                        let current: Record<string, string> = {};
                        try { if (rawHeaders.trim().startsWith('{')) current = JSON.parse(rawHeaders); } catch {}
                        current[keyToAdd] = manualValue.trim();
                        setRawHeaders(JSON.stringify(current, null, 2));
                        setManualValue("");
                        setManualKey("");
                        toast.success(`Added ${keyToAdd}!`);
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </label>

            <div className="grid-2">
              <label className="field">
                <span>
                  li_at
                  {!isLiAtValid && liAt.length > 0 && (
                    <span className="hint" style={{ marginLeft: "0.5rem", color: "var(--err)" }}>(Invalid format)</span>
                  )}
                </span>
                <input
                  type={showTokens ? "text" : "password"}
                  value={liAt}
                  onChange={(e) => setLiAt(e.target.value)}
                  style={{ borderColor: !isLiAtValid && liAt.length > 0 ? "var(--err)" : undefined }}
                  placeholder="AQ..."
                />
              </label>
              <label className="field">
                <span>
                  JSESSIONID
                  {!isJsessionValid && jsessionid !== "ajax:" && jsessionid.length > 0 && (
                    <span className="hint" style={{ marginLeft: "0.5rem", color: "var(--err)" }}>(Should be ajax: + digits)</span>
                  )}
                </span>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: "0.75rem", color: "var(--fg)", pointerEvents: "none", fontFamily: "monospace", fontSize: "0.9rem" }}>ajax:</span>
                  <input
                    type={showTokens ? "text" : "password"}
                    value={jsessionid.replace(/^ajax:/, '')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/^ajax:/, '');
                      setJsessionid("ajax:" + val);
                    }}
                    style={{ borderColor: !isJsessionValid && jsessionid !== "ajax:" && jsessionid.length > 0 ? "var(--err)" : undefined, paddingLeft: "3.2rem" }}
                    placeholder="***"
                  />
                </div>
              </label>
            </div>

            <h3 style={{ margin: "2rem 0 0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.25rem" }}>2. LinkedIn Connection (Required for Commenter)</h3>
            <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-elevated)", borderRadius: "8px", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h4 style={{ margin: "0 0 0.25rem 0" }}>OAuth Integration</h4>
                <p className="hint compact" style={{ margin: 0 }}>Required to securely post comments using the Official API.</p>
              </div>
              <div>
                {linkedinConnected ? (
                  <button 
                    type="button" 
                    className="btn danger ghost" 
                    onClick={async () => {
                      if(confirm("Are you sure you want to disconnect LinkedIn?")) {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                          await fetch('http://localhost:4000/api/linkedin/disconnect', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${session.access_token}` }
                          });
                          onLinkedinConnectedChange(false);
                          toast.success("LinkedIn disconnected");
                        }
                      }
                    }}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="btn primary" 
                    onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session) {
                        const res = await fetch('http://localhost:4000/api/linkedin/connect', {
                          headers: { 'Authorization': `Bearer ${session.access_token}` }
                        });
                        const json = await res.json();
                        if (json.success && json.url) {
                          window.location.href = json.url;
                        } else {
                          toast.error("Failed to start LinkedIn connection");
                        }
                      }
                    }}
                  >
                    Connect LinkedIn
                  </button>
                )}
              </div>
            </div>

            <h3 style={{ margin: "2rem 0 0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.25rem" }}>3. AI Auto-Comment Config</h3>
            <label className="field">
              <span>Enable Auto Commenting</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                <input
                  type="checkbox"
                  checked={commentEnabled}
                  onChange={(e) => setCommentEnabled(e.target.checked)}
                  style={{ width: "1.2rem", height: "1.2rem" }}
                />
                <span style={{ fontSize: "0.85rem", color: commentEnabled ? "var(--ok)" : "var(--muted)" }}>
                  {commentEnabled ? "Active" : "Inactive"}
                </span>
              </div>
            </label>

            <div className="grid-2">
              <label className="field">
                <span>Daily Comment Limit</span>
                <input
                  type="number"
                  min="1"
                  value={commentDailyLimit}
                  onChange={(e) => setCommentDailyLimit(parseInt(e.target.value) || 0)}
                />
              </label>
              <label className="field">
                <span>Interval Between Comments (minutes)</span>
                <input
                  type="number"
                  min="1"
                  value={commentIntervalMin}
                  onChange={(e) => setCommentIntervalMin(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </label>
            </div>

            <label className="field" style={{ marginTop: '1rem' }}>
              <span>AI Prompt (Context: {"{post_text}"} will be replaced with the actual post)</span>
              <textarea
                rows={3}
                value={commentAiPrompt}
                onChange={(e) => setCommentAiPrompt(e.target.value)}
                placeholder="e.g. You are an insightful professional on LinkedIn. Write a short, encouraging comment for this post: {{post_text}}"
              />
            </label>

            <label className="field" style={{ marginTop: '1rem' }}>
              <span>Niche Keywords (Optional, max 3, comma separated)</span>
              <p className="hint compact" style={{ margin: "0.25rem 0 0.5rem" }}>
                If provided, the commenter will search for posts using these keywords. If blank, it comments on your default Home Feed.
              </p>
              <input
                type="text"
                value={commentKeywords}
                onChange={(e) => setCommentKeywords(e.target.value)}
                placeholder="e.g. react, node, devops"
              />
            </label>
            <div style={{ marginTop: '2rem' }}></div>
          </div>
          
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn primary large"
              onClick={handleSave}
              disabled={isVerifying}
              style={{ position: "relative" }}
            >
              {isVerifying ? "Verifying Cookies..." : "Save Configuration"}
            </button>
          </div>
        </div>
      </div>
      {showHelpModal && <CookieHelpModal onClose={() => setShowHelpModal(false)} />}
    </>,
    document.body
  );
}
