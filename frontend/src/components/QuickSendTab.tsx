"use client";

import { useState } from "react";
import { ROLE_LABELS, type Role, type SmtpConfig, type AutomailConfig } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

type Props = {
  userId: string;
  config: SmtpConfig;
  automail: AutomailConfig;
  onSendingChange?: (sending: boolean) => void;
};

export function QuickSendTab({ userId, config, automail, onSendingChange }: Props) {
  const [quickEmail, setQuickEmail] = useState("");
  const [quickRole, setQuickRole] = useState<Role>("fullstack");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickSending, setQuickSending] = useState(false);

  async function handleQuickSend() {
    if (!quickEmail) {
      toast.error("Please enter an email address");
      return;
    }
    if (!config.configured) {
      toast.error("Please verify SMTP settings first.");
      return;
    }

    setQuickSending(true);
    onSendingChange?.(true);

    try {
      const newId = crypto.randomUUID();
      
      const { error: insertError } = await supabase.from("automailsend_recipients").insert({
        id: newId, 
        user_id: userId, 
        email: quickEmail, 
        role: quickRole, 
        title: quickTitle,
        source: "manual", 
        status: "pending"
      });
      
      if (insertError) throw insertError;

      // Trigger backend batch with AI
      const updatedConfig = { 
        ...config, 
        batchMode: "ai", 
        batchTargetIds: [newId] 
      };

      const { error: batchError } = await supabase
        .from("automailsend_app_state")
        .update({ batch_send_pending: true, batch_send_processing: false, config: updatedConfig })
        .eq("user_id", userId);

      if (batchError) throw batchError;

      toast.success("Background quick send started!");
      setQuickEmail("");
      setQuickTitle("");
    } catch (e: any) {
      toast.error("Quick send failed: " + e.message);
    } finally {
      setQuickSending(false);
      onSendingChange?.(false);
    }
  }

  return (
    <section className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-head" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h2>Quick Send (AI)</h2>
        <p className="hint">Instantly generate and send a personalized email to a single contact using AI.</p>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', padding: '2rem', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <label className="field grow">
              <span style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Email Address *</span>
              <input 
                type="email" 
                placeholder="lead@example.com"
                value={quickEmail}
                onChange={e => setQuickEmail(e.target.value)}
                disabled={quickSending}
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              />
            </label>

            <label className="field">
              <span style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Role *</span>
              <select 
                value={quickRole} 
                onChange={e => setQuickRole(e.target.value as Role)}
                disabled={quickSending}
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              >
                {Object.keys(ROLE_LABELS).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r as Role]}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Context / Job Title (Optional)</span>
              <input 
                type="text" 
                placeholder="e.g. CTO at Acme Corp"
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                disabled={quickSending}
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              />
              <span className="hint" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                Providing context helps the AI generate a more personalized email.
              </span>
            </label>

            <div style={{ marginTop: '1rem' }}>
              <button 
                type="button" 
                className="btn large" 
                style={{ 
                  background: 'var(--accent)', 
                  color: '#fff', 
                  border: 'none', 
                  width: '100%', 
                  padding: '1rem',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  opacity: (quickSending || !quickEmail || !automail.enabled) ? 0.6 : 1
                }}
                onClick={handleQuickSend}
                disabled={quickSending || !quickEmail || !automail.enabled}
                title={automail.enabled ? "Send immediately with AI" : "Enable AI Automail first"}
              >
                {quickSending ? "Sending via AI..." : "Send with AI"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
