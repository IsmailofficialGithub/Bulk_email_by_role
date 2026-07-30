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
  const [results, setResults] = useState<SendResult[]>([]);
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
    setResults([]);
    setProgress({ current: 0, total: list.length });
    setStatus(`${options.label}…`);

    const collected: SendResult[] = [];
    let log = [...sentLog];
    const delayMs = Math.max(0, delaySec) * 1000;

    for (let i = 0; i < list.length; i++) {
      const recipient = list[i];
      const already = sentKeys.has(sentKey(recipient.email, recipient.role));

      if (already && !options.force) {
        collected.push({
          email: recipient.email,
          role: recipient.role,
          success: true,
          skipped: true,
        });
        setResults([...collected]);
        setProgress({ current: i + 1, total: list.length });
        continue;
      }

      const tpl = templates[recipient.role];
      const subject = applyPlaceholders(tpl.subject, recipient);
      const content = applyPlaceholders(tpl.content, recipient);
      const name = recipient.title
        ? `${recipient.title} <${recipient.email}>`
        : recipient.email;

      setProgress({ current: i + 1, total: list.length });
      setStatus(`Sending ${name}…`);

      const payload = {
        fromName: config.fromName,
        fromEmail: config.email,
        appPassword: config.appPassword,
        toEmail: recipient.email,
        subject,
        content,
        attachments: tpl.files.map(f => ({
          filename: f.name,
          path: f.url,
          contentType: f.type,
        })),
      };

      try {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          collected.push({
            email: recipient.email,
            role: recipient.role,
            success: true,
          });
          log = markRecord(recipient, log, "sent");
          onSentLogChange(log);
          
          addSentLog(userId, {
             email: recipient.email.toLowerCase(),
             role: recipient.role,
             title: recipient.title,
             status: "sent",
             sentAt: new Date().toISOString(),
          }).catch(console.error);

        } else {
          collected.push({
            email: recipient.email,
            role: recipient.role,
            success: false,
            error: data.error || "Send failed",
          });
          log = markRecord(recipient, log, "failed", data.error || "Send failed");
          onSentLogChange(log);
          
          addSentLog(userId, {
             email: recipient.email.toLowerCase(),
             role: recipient.role,
             title: recipient.title,
             status: "failed",
             error: data.error || "Send failed",
             sentAt: new Date().toISOString(),
          }).catch(console.error);
        }
        setResults([...collected]);
      } catch {
        collected.push({
          email: recipient.email,
          role: recipient.role,
          success: false,
          error: "Network error",
        });
        log = markRecord(recipient, log, "failed", "Network error");
        onSentLogChange(log);
        
        addSentLog(userId, {
           email: recipient.email.toLowerCase(),
           role: recipient.role,
           title: recipient.title,
           status: "failed",
           error: "Network error",
           sentAt: new Date().toISOString(),
        }).catch(console.error);
        
        setResults([...collected]);
      }

      if (i < list.length - 1 && delayMs > 0) {
        setStatus(`Wait ${delaySec}s…`);
        await sleep(delayMs);
      }
    }

    const ok = collected.filter((r) => r.success && !r.skipped).length;
    const skip = collected.filter((r) => r.skipped).length;
    const fail = collected.filter((r) => !r.success).length;
    setStatus(
      `Done · ${ok} sent · ${skip ? `${skip} skipped · ` : ""}${fail} failed`
    );
    if (fail > 0) {
      toast.error(`Completed with ${fail} errors`);
    } else {
      toast.success("All emails processed successfully!");
    }
    onSendingChange(false);
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

        {results.length > 0 && (
          <div className="send-col">
            <div className="send-col-head">
              <h3>This run</h3>
            </div>
            <div className="scroll-area send-scroll">
              <ul className="results">
                {results.map((r) => {
                  const recipient = recipients.find(
                    (x) => x.email === r.email && x.role === r.role
                  );
                  const title = recipient?.title;
                  return (
                    <li
                      key={`${r.email}-${r.role}-${r.skipped ? "s" : "r"}`}
                      className={
                        r.skipped ? "skip" : r.success ? "ok" : "err"
                      }
                    >
                      <span>
                        {title ? `${title} · ` : ""}
                        {r.email} · {ROLE_LABELS[r.role]}
                      </span>
                      <span>
                        {r.skipped
                          ? "Skipped"
                          : r.success
                            ? "Sent"
                            : r.error}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
