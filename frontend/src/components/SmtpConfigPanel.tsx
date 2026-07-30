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

export function SmtpConfigPanel({ config, onChange, onResetAll, onClose }: Props) {
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

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => {
      setEmail(config.email);
      setAppPassword(config.appPassword);
      setEditing(!config.configured);
    }, 0);
  }, [config.email, config.appPassword, config.configured]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      onClose();
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
                  Gmail + App Password · saved in browser
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
                  <span>
                    App Password
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
                  </span>
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
        </div>,
    document.body
  );
}
