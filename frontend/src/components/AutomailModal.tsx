"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { AutomailConfig, SmtpConfig, Role, RoleTemplate } from "@/lib/types";
import toast from "react-hot-toast";
import { HelpTooltip } from "./HelpTooltip";

type Props = {
  config: AutomailConfig;
  smtpConfig: SmtpConfig;
  templates: Record<Role, RoleTemplate>;
  onSave: (config: AutomailConfig) => void;
  onClose: () => void;
};

export function AutomailModal({ config, smtpConfig, templates, onSave, onClose }: Props) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [dailyLimit, setDailyLimit] = useState(config.dailyLimit);
  const [aiProvider, setAiProvider] = useState<"none" | "groq" | "openai" | "gemini">(config.aiProvider || "none");
  const [aiApiKey, setAiApiKey] = useState(config.aiApiKey || "");
  const [aiPrompt, setAiPrompt] = useState(config.aiPrompt || "You are an expert recruiter. Analyze the following LinkedIn post text. The author's email is {{email}}. Write a highly personalized, friendly, and concise email subject and body offering our services. Output ONLY valid JSON with 'subject' and 'body' keys.");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSave() {
    if (enabled) {
      // 1. Verify SMTP is configured
      if (!smtpConfig.email || !smtpConfig.appPassword) {
        toast.error("Please configure SMTP settings first!");
        setEnabled(false);
        return;
      }

      // 2. Verify SMTP credentials work
      setLoading(true);
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: smtpConfig.email, appPassword: smtpConfig.appPassword }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error(data.error || "SMTP Verification failed. Please check your credentials.");
          setEnabled(false);
          setLoading(false);
          return;
        }
      } catch {
        toast.error("Network error verifying SMTP credentials.");
        setEnabled(false);
        setLoading(false);
        return;
      }
      setLoading(false);

      // 3. Verify at least one template exists
      const hasTemplate = Object.values(templates).some(t => t.subject.trim() !== "" && t.content.trim() !== "");
      if (!hasTemplate) {
        toast.error("Please create at least one email template before enabling Automail!");
        setEnabled(false);
        return;
      }
    }

    onSave({
      enabled,
      dailyLimit,
      aiProvider,
      aiApiKey,
      aiPrompt,
    });
    toast.success("Automail settings saved!");
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="automail-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="automail-modal-title">AI & Automail Settings</h2>
            <p className="hint compact">
              Automail will automatically send emails to pending contacts in the background.
            </p>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>
              Enable Background Automail
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: "1.2rem", height: "1.2rem" }}
              />
              <span style={{ fontSize: "0.85rem", color: enabled ? "var(--ok)" : "var(--muted)" }}>
                {enabled ? "Active" : "Inactive"}
              </span>
            </div>
          </label>

          {enabled && (
            <>
              <label className="field">
                <span>
                  Daily Mail Limit
                  <HelpTooltip 
                    title="Daily Mail Limit" 
                    content={
                      <>
                        <p>The maximum number of emails the system is allowed to send automatically in a single day.</p>
                        <p><strong>Recommendation:</strong> Keep this under 50 to avoid your email provider (like Gmail) flagging your account for spam.</p>
                      </>
                    } 
                  />
                </span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value) || 1)}
                />
                <span className="hint compact">Maximum emails to send automatically per day.</span>
              </label>

              <hr />
              <h3>AI Personalization (Optional)</h3>
              <p className="hint compact">
                Generate highly personalized emails based on the LinkedIn post content using AI.
              </p>

              <label className="field">
                <span>
                  AI Provider
                  <HelpTooltip 
                    title="AI Provider" 
                    content={
                      <>
                        <p>Choose an Artificial Intelligence service to write personalized emails for you.</p>
                        <p>When the scraper finds an email in a LinkedIn post, the AI will read the actual post and write a unique, relevant email to the author before sending it.</p>
                        <p>Select <strong>None</strong> to just use your static email templates.</p>
                      </>
                    } 
                  />
                </span>
                <select 
                  value={aiProvider} 
                  onChange={(e) => setAiProvider(e.target.value as any)}
                >
                  <option value="none">None (Use Default Templates)</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="groq">Groq (Llama3, etc.)</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </label>

              {aiProvider !== "none" && (
                <>
                  <label className="field">
                    <span>API Key</span>
                    <input
                      type="password"
                      placeholder={`Enter your ${aiProvider} API Key`}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                    />
                  </label>
                  
                  <label className="field">
                    <span>
                      AI Prompt
                      <HelpTooltip 
                        title="AI Prompt" 
                        content={
                          <>
                            <p>The instructions you give to the AI.</p>
                            <p>Tell the AI how to act, what tone to use, and what your company does. The system will automatically inject the LinkedIn post at the end of your prompt so the AI has context.</p>
                            <p><strong>Note:</strong> The AI <em>must</em> return JSON format with a <code>subject</code> and <code>body</code>.</p>
                          </>
                        } 
                      />
                    </span>
                    <textarea
                      rows={5}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                    />
                    <span className="hint compact">
                      Available placeholders: {"{{email}}"}, {"{{title}}"}. 
                      The post text will be automatically appended to the end of your prompt.
                    </span>
                  </label>
                </>
              )}
            </>
          )}

        </div>
        
        <hr style={{ border: "0", borderTop: "1px solid var(--line)", margin: "1rem 0" }} />
        
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
