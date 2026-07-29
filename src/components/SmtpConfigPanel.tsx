"use client";

import { useState } from "react";
import type { SmtpConfig } from "@/lib/types";

type Props = {
  config: SmtpConfig;
  onChange: (config: SmtpConfig) => void;
};

export function SmtpConfigPanel({ config, onChange }: Props) {
  const [email, setEmail] = useState(config.email);
  const [appPassword, setAppPassword] = useState(config.appPassword);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

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
      setMessage({ type: "ok", text: "SMTP configured and verified" });
    } catch {
      onChange({ email, appPassword, configured: false });
      setMessage({ type: "err", text: "Network error while verifying" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>1. SMTP Config</h2>
        <span className={config.configured ? "badge ok" : "badge warn"}>
          {config.configured ? "Ready" : "Not configured"}
        </span>
      </div>
      <p className="hint">
        Use your Gmail address and a Google App Password (not your normal
        password).
      </p>
      <div className="grid-2">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              onChange({ email: e.target.value, appPassword, configured: false });
              setMessage(null);
            }}
            placeholder="you@gmail.com"
          />
        </label>
        <label className="field">
          <span>App Password</span>
          <input
            type="password"
            value={appPassword}
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
        </label>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn primary"
          onClick={handleVerify}
          disabled={loading || !email || !appPassword}
        >
          {loading ? "Verifying…" : "Config / Verify"}
        </button>
        {message && (
          <span className={message.type === "ok" ? "msg ok" : "msg err"}>
            {message.text}
          </span>
        )}
      </div>
    </section>
  );
}
