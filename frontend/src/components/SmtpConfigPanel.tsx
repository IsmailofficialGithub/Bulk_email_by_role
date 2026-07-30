"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SmtpConfig } from "@/lib/types";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { HelpTooltip } from "./HelpTooltip";

type Props = {
  config: SmtpConfig;
  onChange: (config: SmtpConfig) => void;
  onResetAll: () => void;
  onClose: () => void;
};

const PROVIDERS = [
  { id: "gmail", name: "Gmail", host: "smtp.gmail.com", port: 465, userLabel: "Username / Login", passLabel: "App Password", tooltip: "Google App Password" },
  { id: "sendgrid", name: "SendGrid", host: "smtp.sendgrid.net", port: 465, userLabel: "Username (usually 'apikey')", passLabel: "API Key", tooltip: "SendGrid API Key" },
  { id: "resend", name: "Resend", host: "smtp.resend.com", port: 465, userLabel: "Username (usually 'resend')", passLabel: "API Key", tooltip: "Resend API Key" },
  { id: "custom", name: "Custom", host: "", port: 465, userLabel: "SMTP Username", passLabel: "SMTP Password", tooltip: "SMTP Credentials" },
];

export function SmtpConfigPanel({ config, onChange, onResetAll, onClose }: Props) {
  const [email, setEmail] = useState(config.email);
  const [fromEmail, setFromEmail] = useState(config.fromEmail || "");
  const [fromName, setFromName] = useState(config.fromName || "");
  const [appPassword, setAppPassword] = useState(config.appPassword);
  
  const [provider, setProvider] = useState(config.provider || "gmail");
  const [host, setHost] = useState(config.host || "smtp.gmail.com");
  const [port, setPort] = useState(config.port || 465);

  const [showPassword, setShowPassword] = useState(false);
  const [editing, setEditing] = useState(!config.configured);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => {
      setEmail(config.email);
      setFromEmail(config.fromEmail || "");
      setFromName(config.fromName || "");
      setAppPassword(config.appPassword);
      setProvider(config.provider || "gmail");
      setHost(config.host || "smtp.gmail.com");
      setPort(config.port || 465);
      setEditing(!config.configured);
    }, 0);
  }, [config]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const locked = config.configured && !editing;
  const displayAppPassword = appPassword.startsWith("enc:") ? "����������������" : appPassword;
  
  const currentProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  function handleProviderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setProvider(val);
    const p = PROVIDERS.find(x => x.id === val);
    if (p && p.id !== "custom") {
      setHost(p.host);
      setPort(p.port);
    }
  }

  async function handleVerify() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, appPassword, host, port }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({ type: "err", text: data.error || "Verification failed" });
        toast.error(data.error || "Verification failed");
        return;
      }
      
      // ONLY trigger onChange (which saves) upon successful verify!
      onChange({ 
        email: email.trim(),
        appPassword: isMasked ? config.appPassword : appPassword.trim(),
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        provider,
        host,
        port,
        configured: true 
      });
      setEditing(false);
      setMessage({ type: "ok", text: "Verified" });
      toast.success("SMTP config verified!");
      onClose();
    } catch {
      setMessage({ type: "err", text: "Network error" });
      toast.error("Network error during verification");
    } finally {
      setLoading(false);
    }
  }

  function handleChangeSettings() {
    setEditing(true);
    // Don't call onChange here so we don't clear the DB credentials until verified
    setMessage({ type: "ok", text: "Edit then verify" });
  }

  function handleReset() {
    if (
      !window.confirm(
        "Reset all settings? Clears SMTP, recipients, templates, and delay."
      )
    ) {
      return;
    }
    onResetAll();
    setEmail("");
    setFromEmail("");
    setFromName("");
    setAppPassword("");
    setProvider("gmail");
    setHost("smtp.gmail.com");
    setPort(465);
    setEditing(true);
    setShowPassword(false);
    setMessage({ type: "ok", text: "Reset done" });
    toast.success("All settings have been reset.");
  }

  if (!mounted) return null;

  return createPortal(
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => config.configured && onClose()}
          style={{ zIndex: 99999 }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="smtp-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h2 id="smtp-modal-title">SMTP settings</h2>
                <p className="hint compact">
                  Connect your email provider to send emails
                </p>
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <div className="modal-body">
              <div className="grid-2">
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>Provider</span>
                  <select value={provider} onChange={handleProviderChange} disabled={locked}>
                    {PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>

                {provider === "custom" && (
                  <>
                    <label className="field">
                      <span>SMTP Host</span>
                      <input
                        type="text"
                        value={host}
                        disabled={locked}
                        onChange={(e) => {
                          setHost(e.target.value);
                          setMessage(null);
                        }}
                        placeholder="smtp.example.com"
                      />
                    </label>
                    <label className="field">
                      <span>Port</span>
                      <input
                        type="number"
                        value={port}
                        disabled={locked}
                        onChange={(e) => {
                          setPort(parseInt(e.target.value, 10));
                          setMessage(null);
                        }}
                        placeholder="465"
                      />
                    </label>
                  </>
                )}

                <label className="field">
                  <span>From / Sender Email</span>
                  <input
                    type="email"
                    value={fromEmail}
                    disabled={locked}
                    onChange={(e) => {
                      setFromEmail(e.target.value);
                      setMessage(null);
                    }}
                    placeholder={email || "e.g. mail@example.com"}
                  />
                </label>

                <label className="field">
                  <span>From / Sender Name</span>
                  <input
                    type="text"
                    value={fromName}
                    disabled={locked}
                    onChange={(e) => {
                      setFromName(e.target.value);
                      setMessage(null);
                    }}
                    placeholder="e.g. John Doe"
                  />
                </label>

                <label className="field">
                  <span>{currentProvider.userLabel}</span>
                  <input
                    type="text"
                    value={email}
                    disabled={locked}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setMessage(null);
                    }}
                    placeholder={provider === 'gmail' ? "you@gmail.com" : ""}
                  />
                </label>

                <label className="field">
                  <span>
                    {currentProvider.passLabel}
                    {provider === 'gmail' && (
                      <HelpTooltip 
                        title="Google App Password" 
                        content={
                          <>
                            <p>To let this app send emails on your behalf, you need a <strong>Google App Password</strong>.</p>
                            <p><strong>Steps to generate one:</strong></p>
                            <ol style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
                              <li>Go to your Google Account Settings.</li>
                              <li>Turn on <strong>2-Step Verification</strong> if it isn't already.</li>
                              <li>Search for "App Passwords" in your account settings.</li>
                              <li>Create a new app password (name it "AutoMailSend") and copy the 16-character code.</li>
                            </ol>
                            <p>Paste that 16-character code here (spaces don't matter).</p>
                          </>
                        } 
                      />
                    )}
                  </span>
                  <div className="password-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={displayAppPassword}
                      disabled={locked}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (appPassword.startsWith("enc:")) {
                          val = val.replace(/�/g, "");
                        }
                        setAppPassword(val);
                        setMessage(null);
                      }}
                      placeholder="xxxx xxxx xxxx xxxx"
                    />
                    <button
                      type="button"
                      className="btn ghost password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              </div>

              <div className="row">
                {!locked && (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleVerify}
                    disabled={loading || !email || !appPassword || !host || !port}
                  >
                    {loading ? "�" : "Verify & Save"}
                  </button>
                )}
                {locked && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleChangeSettings}
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={handleReset}
                >
                  Reset all
                </button>
                {message && (
                  <span
                    className={message.type === "ok" ? "msg ok" : "msg err"}
                  >
                    {message.text}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>,
    document.body
  );
}
