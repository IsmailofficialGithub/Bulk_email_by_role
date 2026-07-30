"use client";

import { useMemo, useState } from "react";
import {
  ROLE_LABELS,
  type Recipient,
  type Role,
  type RoleTemplate,
  type SendResult,
  type SentRecord,
  type SmtpConfig,
} from "@/lib/types";
import { addSentLog } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

type Props = {
  userId: string;
  config: SmtpConfig;
  recipients: Recipient[];
  templates: Record<Role, RoleTemplate>;
  delaySec: number;
  onDelayChange: (delaySec: number) => void;
  sending: boolean;
  onSendingChange: (sending: boolean) => void;
  sentLog: SentRecord[];
  onSentLogChange: (sentLog: SentRecord[]) => void;
  automail: import("@/lib/types").AutomailConfig;
  onAutomailChange: (automail: import("@/lib/types").AutomailConfig) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyPlaceholders(text: string, recipient: Recipient): string {
  return text
    .replaceAll("{{title}}", recipient.title || "")
    .replaceAll("{{email}}", recipient.email);
}

function sentKey(email: string, role: Role) {
  return `${email.toLowerCase()}::${role}`;
}

export function SendPanel({
  userId,
  config,
  recipients,
  templates,
  delaySec,
  onDelayChange,
  sending,
  onSendingChange,
  sentLog,
  onSentLogChange,
  automail,
  onAutomailChange,
}: Props) {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sentKeys = useMemo(
    () => new Set(sentLog.filter(s => s.status === "sent" || s.status === "skipped").map((s) => sentKey(s.email, s.role))),
    [sentLog]
  );

  const pending = useMemo(
    () =>
      recipients.filter((r) => !sentKeys.has(sentKey(r.email, r.role))),
    [recipients, sentKeys]
  );
  
  const selectedPending = useMemo(
    () => pending.filter(r => selectedIds.has(r.id)),
    [pending, selectedIds]
  );

  const activeSent = useMemo(() => {
    return recipients.filter((r) => sentKeys.has(sentKey(r.email, r.role)));
  }, [recipients, sentKeys]);

  function markRecord(recipient: Recipient, log: SentRecord[], status: "sent" | "failed" | "skipped", error?: string) {
    const next = [...log];
    next.unshift({
      email: recipient.email.toLowerCase(),
      role: recipient.role,
      title: recipient.title,
      status,
      error,
      sentAt: new Date().toISOString(),
    });
    return next;
  }

  async function sendList(
    list: Recipient[],
    options: { force: boolean; label: string }
  ) {
    if (!config.configured) {
      setStatus("Verify SMTP first.");
      toast.error("Please verify SMTP settings first.");
      return;
    }
    if (!list.length) {
      setStatus(options.force ? "Nothing to resend." : "No pending emails.");
      toast.error(options.force ? "Nothing to resend." : "No pending emails.");
      return;
    }

    for (const role of new Set(list.map((r) => r.role))) {
      if (!templates[role].subject.trim()) {
        setStatus(`Missing subject: ${ROLE_LABELS[role]}`);
        toast.error(`Missing subject for role: ${ROLE_LABELS[role]}`);
        return;
      }
    }

    onSendingChange(true);
    setProgress({ current: 0, total: list.length });
    setStatus(`Queuing ${list.length} emails…`);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("You must be logged in to send emails.");
      onSendingChange(false);
      return;
    }

    try {
      const toProcess = list.filter(r => options.force || !sentKeys.has(sentKey(r.email, r.role)));

      if (toProcess.length === 0) {
        setStatus("Nothing new to send.");
        toast.success("All selected emails have already been sent.");
        onSendingChange(false);
        return;
      }

      const res = await fetch("/api/send-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: toProcess,
          templates,
          config,
          delaySec,
          userId,
          accessToken: session.access_token
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus("Failed to start batch.");
        toast.error(data.error || "Failed to queue background batch");
      } else {
        setStatus("Background send started! You can safely close the tab.");
        toast.success("Background send started! You can safely close the tab.");
      }
    } catch {
      setStatus("Network error queuing batch.");
      toast.error("Network error queuing batch.");
    } finally {
      onSendingChange(false);
    }
  }

  function clearSentHistory() {
    if (!window.confirm("Clear sent history? Pending list will include them again.")) {
      return;
    }
    onSentLogChange([]);
    setStatus("Sent history cleared.");
    toast.success("Sent history cleared.");
  }

  function removeSentRecord(email: string, role: Role) {
    onSentLogChange(
      sentLog.filter((s) => sentKey(s.email, s.role) !== sentKey(email, role))
    );
  }
  
  function toggleSelectAllPending() {
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map(r => r.id)));
    }
  }

  function toggleSelected(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>4. Send Emails</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <span className="badge">
            {pending.length} pending · {sentLog.length} history
          </span>
        </div>
      </div>
      <div className="panel-body">
        <p className="hint compact">
          Successfully sent are skipped · failed remain pending
        </p>

        <div className="add-row">
          <label className="field grow">
            <span>Delay (sec)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={delaySec}
              onChange={(e) => onDelayChange(Number(e.target.value) || 0)}
              disabled={sending}
            />
          </label>
          <button
            type="button"
            className="btn primary large"
            onClick={() =>
              sendList(pending, { force: false, label: "Sending all pending" })
            }
            disabled={sending || pending.length === 0}
          >
            {sending
              ? `${progress.current}/${progress.total}`
              : `Send All Pending (${pending.length})`}
          </button>
          
          <button
            type="button"
            className="btn large"
            onClick={() =>
              sendList(selectedPending, { force: false, label: "Sending selected" })
            }
            disabled={sending || selectedPending.length === 0}
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            Send Selected ({selectedPending.length})
          </button>
          <button
            type="button"
            className="btn large"
            onClick={() =>
              sendList(activeSent, {
                force: true,
                label: "Resending",
              })
            }
            disabled={sending || activeSent.length === 0}
          >
            Resend successful ({activeSent.length})
          </button>
        </div>

        {status && <p className="status-line">{status}</p>}

        {sending && progress.total > 0 && (
          <div className="progress">
            <div
              className="progress-bar"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        )}

        <div className="send-columns">
          <div className="send-col">
            <div className="send-col-head">
              <h3>Pending</h3>
              <div className="send-col-actions">
                <span className="chip">{pending.length}</span>
                {pending.length > 0 && (
                  <button type="button" className="btn ghost" onClick={toggleSelectAllPending} disabled={sending}>
                    {selectedIds.size === pending.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
            </div>
            <div className="scroll-area send-scroll">
              {pending.length === 0 ? (
                <p className="hint">No pending emails</p>
              ) : (
                <ul className="results">
                  {pending.map((r) => (
                    <li key={r.id} className="pending" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => toggleSelected(r.id)}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(r.id)} 
                        onChange={() => {}} 
                        disabled={sending} 
                        style={{ cursor: 'pointer' }}
                      />
                      <span>
                        {r.title ? `${r.title} · ` : ""}
                        {r.email} · {ROLE_LABELS[r.role]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="send-col">
            <div className="send-col-head">
              <h3>History & Skipped</h3>
              <div className="send-col-actions">
                <span className="chip">
                  {sentLog.length} logs
                </span>
                {sentLog.length > 0 && (
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={clearSentHistory}
                    disabled={sending}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="scroll-area send-scroll">
              
              {activeSent.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", margin: "0.5rem 0", padding: "0 0.5rem" }}>
                    Currently Skipped ({activeSent.length})
                  </h4>
                  <ul className="results">
                    {activeSent.map((r) => (
                      <li key={r.id} className="ok sent-row" style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)" }}>
                        <span>
                          {r.title ? `${r.title} · ` : ""}
                          {r.email} · {ROLE_LABELS[r.role]}
                        </span>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={sending}
                          onClick={() =>
                            sendList([r], { force: true, label: "Resending one" })
                          }
                        >
                          Resend
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", margin: "0.5rem 0", padding: "0 0.5rem" }}>
                All History
              </h4>
              {sentLog.length === 0 ? (
                <p className="hint">No history yet</p>
              ) : (
                <ul className="results">
                  {sentLog.map((s, idx) => (
                    <li
                      key={`${s.email}-${s.role}-${s.sentAt}-${idx}`}
                      className={s.status === "failed" ? "err sent-row" : "ok sent-row"}
                      title={s.error || s.status}
                    >
                      <span>
                        {s.title ? `${s.title} · ` : ""}
                        {s.email} · {ROLE_LABELS[s.role]}
                      </span>
                      <span className="sent-actions">
                        <span className={`badge ${s.status === "failed" ? "danger" : "ok"}`} style={{ marginRight: '0.5rem' }}>
                          {s.status}
                        </span>
                        <button
                          type="button"
                          className="btn ghost danger"
                          disabled={sending}
                          onClick={() => removeSentRecord(s.email, s.role)}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
      </div>
      </div>
    </section>
  );
}
