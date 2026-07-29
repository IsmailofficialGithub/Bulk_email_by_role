"use client";

import { useEffect, useState } from "react";
import type { SmtpConfig } from "@/lib/types";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

type Props = {
  config: SmtpConfig;
  onChange: (config: SmtpConfig) => void;
  onResetAll: () => void;
};

export function SmtpConfigPanel({ config, onChange, onResetAll }: Props) {
  const [open, setOpen] = useState(!config.configured);
  const [email, setEmail] = useState(config.email);
  const [appPassword, setAppPassword] = useState(config.appPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [editing, setEditing] = useState(!config.configured);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setEmail(config.email);
    setAppPassword(config.appPassword);
    setEditing(!config.configured);
    setOpen(!config.configured);
  }, [config.email, config.appPassword, config.configured]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const locked = config.configured && !editing;
  const displayAppPassword = appPassword.startsWith("enc:") ? "••••••••••••••••" : appPassword;

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
        toast.error(data.error || "Verification failed");
        return;
      }
      onChange({ email, appPassword: data.encryptedPassword || appPassword, configured: true });
      setEditing(false);
      setMessage({ type: "ok", text: "Verified" });
      toast.success("SMTP config verified!");
      setOpen(false);
    } catch {
      onChange({ email, appPassword, configured: false });
      setMessage({ type: "err", text: "Network error" });
      toast.error("Network error during verification");
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
    toast.success("All settings have been reset.");
    setOpen(true);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      toast.error(error.message || "Failed to update password");
    } else {
      toast.success("Login password updated successfully!");
      setNewPassword("");
    }
  }

  function openModal() {
    setMessage(null);
    setOpen(true);
  }

  return (
    <>
      <div className="smtp-bar">
        <div className="smtp-bar-left">
          <span className="smtp-bar-title">SMTP</span>
          <span className={config.configured ? "badge ok" : "badge warn"}>
            {config.configured ? "Ready" : "Setup needed"}
          </span>
          {config.email && (
            <span className="smtp-bar-email" title={config.email}>
              {config.email}
            </span>
          )}
        </div>
        <div className="smtp-bar-actions">
          <button type="button" className="btn primary" onClick={openModal}>
            Expand
          </button>
          {config.configured && (
            <button
              type="button"
              className="btn ghost danger"
              onClick={handleReset}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => config.configured && setOpen(false)}
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
                  Gmail + App Password · saved in browser
                </p>
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="modal-body">
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
                      value={displayAppPassword}
                      disabled={locked}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (appPassword.startsWith("enc:")) {
                          val = val.replace(/•/g, "");
                        }
                        setAppPassword(val);
                        onChange({
                          email,
                          appPassword: val,
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
                    disabled={loading || !email || !appPassword}
                  >
                    {loading ? "…" : "Verify"}
                  </button>
                )}
                {locked && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleChangeSettings}
                  >
                    Change
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

              <div style={{ height: "1px", background: "var(--line)", margin: "0.5rem 0" }} />
              
              <div>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", fontFamily: "var(--font-display)" }}>Account Settings</h3>
                <form onSubmit={handlePasswordChange} className="grid-2" style={{ alignItems: "flex-end" }}>
                  <label className="field">
                    <span>New Login Password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      disabled={passwordLoading}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn"
                    disabled={passwordLoading || !newPassword}
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
