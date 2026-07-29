"use client";

import { useEffect, useState } from "react";
import type { SmtpConfig } from "@/lib/types";

type Props = {
  config: SmtpConfig;
  onChange: (config: SmtpConfig) => void;
  onResetAll: () => void;
};

export function SmtpConfigPanel({ config, onChange, onResetAll }: Props) {
  const [email, setEmail] = useState(config.email);
  const [appPassword, setAppPassword] = useState(config.appPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [editing, setEditing] = useState(!config.configured);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    setEmail(config.email);
    setAppPassword(config.appPassword);
    setEditing(!config.configured);
  }, [config.email, config.appPassword, config.configured]);

  const locked = config.configured && !editing;

  async function handleVerify() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, appPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        onChange({ email, appPassword, configured: false });
        setMessage({ type: "err", text: data.error || "Verification failed" });
        return;
      }
      onChange({ email, appPassword, configured: true });
      setEditing(false);
      setMessage({ type: "ok", text: "Verified" });
    } catch {
      onChange({ email, appPassword, configured: false });
      setMessage({ type: "err", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  function handleChangeSettings() {
    setEditing(true);
    onChange({ email, appPassword, configured: false });
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
    setAppPassword("");
    setEditing(true);
    setShowPassword(false);
    setMessage({ type: "ok", text: "Reset done" });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>1. SMTP</h2>
        <span className={config.configured ? "badge ok" : "badge warn"}>
          {config.configured ? "Ready" : "Setup"}
        </span>
      </div>
      <div className="panel-body">
        <p className="hint compact">Gmail + App Password · saved in browser</p>
        <div className="grid-2">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              disabled={locked}
              onChange={(e) => {
                setEmail(e.target.value);
                onChange({
                  email: e.target.value,
                  appPassword,
                  configured: false,
                });
                setMessage(null);
              }}
              placeholder="you@gmail.com"
            />
          </label>
          <label className="field">
            <span>App Password</span>
            <div className="password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={appPassword}
                disabled={locked}
                onChange={(e) => {
                  setAppPassword(e.target.value);
                  onChange({
                    email,
                    appPassword: e.target.value,
                    configured: false,
                  });
                  setMessage(null);
                }}
                placeholder="xxxx xxxx xxxx xxxx"
              />
              <button
                type="button"
                className="btn ghost password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
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
              disabled={loading || !email || !appPassword}
            >
              {loading ? "…" : "Verify"}
            </button>
          )}
          {locked && (
            <button type="button" className="btn" onClick={handleChangeSettings}>
              Change
            </button>
          )}
          <button
            type="button"
            className="btn ghost danger"
            onClick={handleReset}
          >
            Reset
          </button>
          {message && (
            <span className={message.type === "ok" ? "msg ok" : "msg err"}>
              {message.text}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
