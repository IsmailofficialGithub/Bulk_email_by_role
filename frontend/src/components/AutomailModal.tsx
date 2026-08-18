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
  sentTodayCount: number;
  onSave: (config: AutomailConfig) => void;
  onClose: () => void;
};

export function AutomailModal({ config, smtpConfig, templates, sentTodayCount, onSave, onClose }: Props) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [dailyLimit, setDailyLimit] = useState(config.dailyLimit);
  
  const [selectedProvider, setSelectedProvider] = useState<string>(() => {
    if (!config.aiProvider || config.aiProvider === "none") return "none";
    if (config.aiProvider.startsWith("groq")) return "groq";
    if (config.aiProvider.startsWith("openai")) return "openai";
    if (config.aiProvider.startsWith("gemini")) return "gemini";
    return "none";
  });
  
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (config.aiProvider && config.aiProvider.includes(":")) {
      return config.aiProvider.split(":")[1];
    }
    if (config.aiProvider?.startsWith("groq")) return "openai/gpt-oss-120b";
    if (config.aiProvider?.startsWith("openai")) return "gpt-4o-mini";
    if (config.aiProvider?.startsWith("gemini")) return "gemini-1.5-flash";
    return "";
  });

  const [aiApiKey, setAiApiKey] = useState(config.aiApiKey || "");
  const [aiPrompt, setAiPrompt] = useState(config.aiPrompt || "You are an expert recruiter. Analyze the following LinkedIn post text. The author's email is {{email}}. Write a highly personalized, friendly, and concise email subject and body offering our services. CRITICAL: DO NOT use placeholders like [Name], [Company], etc. If you don't know a piece of information, either infer it from the context or rephrase to omit it. Always sign off with a proper name if available, never use placeholders or generic company names for the sender signature. Output ONLY valid JSON with 'subject' and 'body' keys.");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSave() {
    let finalEnabled = enabled;

    if (finalEnabled) {
      // 1. Verify SMTP is configured
      if (!smtpConfig.email || !smtpConfig.appPassword) {
        toast.error("SMTP not configured. Automail disabled, but saving AI settings.");
        finalEnabled = false;
        setEnabled(false);
      } else {
        // 2. Verify SMTP credentials work
        setLoading(true);
        try {
          let defaultHost = 'smtp.gmail.com';
          let defaultPort = 465;
          if (smtpConfig.email.includes('@outlook.com') || smtpConfig.email.includes('@hotmail.com')) {
            defaultHost = 'smtp-mail.outlook.com';
            defaultPort = 587;
          }

          const res = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              email: smtpConfig.email, 
              appPassword: smtpConfig.appPassword,
              host: smtpConfig.host || defaultHost,
              port: smtpConfig.port || defaultPort
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            toast.error(data.error || "SMTP Verification failed. Automail disabled, but saving AI settings.");
            finalEnabled = false;
            setEnabled(false);
          }
        } catch {
          toast.error("Network error verifying SMTP. Automail disabled, but saving AI settings.");
          finalEnabled = false;
          setEnabled(false);
        }
        setLoading(false);

        // 3. Verify at least one template exists
        if (finalEnabled) {
          const hasTemplate = Object.values(templates).some(t => t.subject.trim() !== "" && t.content.trim() !== "");
          if (!hasTemplate) {
            toast.error("No email templates found. Automail disabled, but saving AI settings.");
            finalEnabled = false;
            setEnabled(false);
          }
        }
      }
    }

    let finalAiProvider = selectedProvider;
    if (selectedProvider !== "none" && selectedModel) {
      finalAiProvider = `${selectedProvider}:${selectedModel}`;
    }

    onSave({
      enabled: finalEnabled,
      dailyLimit,
      aiProvider: finalAiProvider,
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
                id="tour-automail-enable"
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

          <div style={{ opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <input
                    id="tour-automail-rules"
                    type="number"
                    min={1}
                    max={500}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value) || 1)}
                    style={{ width: "100px" }}
                  />
                  <span style={{ fontSize: "1.05rem", fontWeight: "500", color: "var(--muted)" }}>
                    emails (Sent today: {sentTodayCount})
                  </span>
                </div>
                  <span className="hint compact">Maximum emails Automail will send per day. Keep delay between emails to a few seconds (not hours) so this quota can actually fill. The worker sends continuously in the background until this number is reached.</span>
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
                  id="tour-automail-provider"
                  value={selectedProvider} 
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    setSelectedProvider(newProvider);
                    if (newProvider === "groq") setSelectedModel("openai/gpt-oss-120b");
                    else if (newProvider === "openai") setSelectedModel("gpt-4o-mini");
                    else if (newProvider === "gemini") setSelectedModel("gemini-1.5-flash");
                  }}
                >
                  <option value="none">None (Use Default Templates)</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="groq">Groq</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </label>

              <div style={{ opacity: selectedProvider !== "none" ? 1 : 0.4, pointerEvents: selectedProvider !== "none" ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                <label className="field">
                  <span>AI Model</span>
                  <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {selectedProvider === "groq" && (
                      <>
                        <option value="openai/gpt-oss-120b">GPT OSS 120B</option>
                        <option value="whisper-large-v3">Whisper Large v3</option>
                      </>
                    )}
                    {selectedProvider === "openai" && (
                      <>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </>
                    )}
                    {selectedProvider === "gemini" && (
                      <>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                      </>
                    )}
                    </select>
                  </label>

                  <label className="field">
                    <span>API Key</span>
                    <input
                      id="tour-automail-key"
                      type="password"
                      placeholder={`Enter your ${selectedProvider} API Key`}
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
              </div>
          </div>

        </div>
        
        <hr style={{ border: "0", borderTop: "1px solid var(--line)", margin: "1rem 0" }} />
        
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button id="tour-automail-save" className="btn primary" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
