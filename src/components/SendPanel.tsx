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

type Props = {
  config: SmtpConfig;
  recipients: Recipient[];
  templates: Record<Role, RoleTemplate>;
  delaySec: number;
  onDelayChange: (delaySec: number) => void;
  sending: boolean;
  onSendingChange: (sending: boolean) => void;
  sentLog: SentRecord[];
  onSentLogChange: (sentLog: SentRecord[]) => void;
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
  config,
  recipients,
  templates,
  delaySec,
  onDelayChange,
  sending,
  onSendingChange,
  sentLog,
  onSentLogChange,
}: Props) {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<SendResult[]>([]);

  const sentKeys = useMemo(
    () => new Set(sentLog.map((s) => sentKey(s.email, s.role))),
    [sentLog]
  );

  const pending = useMemo(
    () =>
      recipients.filter((r) => !sentKeys.has(sentKey(r.email, r.role))),
    [recipients, sentKeys]
  );

  const alreadySent = useMemo(() => {
    const fromRecipients = recipients.filter((r) =>
      sentKeys.has(sentKey(r.email, r.role))
    );
    const recipientKeys = new Set(
      fromRecipients.map((r) => sentKey(r.email, r.role))
    );
    const orphans = sentLog.filter(
      (s) => !recipientKeys.has(sentKey(s.email, s.role))
    );
    return { active: fromRecipients, history: orphans };
  }, [recipients, sentKeys, sentLog]);

  function markSent(recipient: Recipient, log: SentRecord[]) {
    const key = sentKey(recipient.email, recipient.role);
    const next = log.filter((s) => sentKey(s.email, s.role) !== key);
    next.unshift({
      email: recipient.email.toLowerCase(),
      role: recipient.role,
      title: recipient.title,
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
      return;
    }
    if (!list.length) {
      setStatus(options.force ? "Nothing to resend." : "No pending emails.");
      return;
    }

    for (const role of new Set(list.map((r) => r.role))) {
      if (!templates[role].subject.trim()) {
        setStatus(`Missing subject: ${ROLE_LABELS[role]}`);
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

      const formData = new FormData();
      formData.append("fromEmail", config.email);
      formData.append("appPassword", config.appPassword);
      formData.append("toEmail", recipient.email);
      formData.append("subject", subject);
      formData.append("content", content);
      tpl.files.forEach((file, idx) => {
        formData.append(`attachment_${idx}`, file);
      });

      try {
        const res = await fetch("/api/send", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          collected.push({
            email: recipient.email,
            role: recipient.role,
            success: true,
          });
          log = markSent(recipient, log);
          onSentLogChange(log);
        } else {
          collected.push({
            email: recipient.email,
            role: recipient.role,
            success: false,
            error: data.error || "Send failed",
          });
        }
        setResults([...collected]);
      } catch {
        collected.push({
          email: recipient.email,
          role: recipient.role,
          success: false,
          error: "Network error",
        });
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
    onSendingChange(false);
  }

  function clearSentHistory() {
    if (!window.confirm("Clear sent history? Pending list will include them again.")) {
      return;
    }
    onSentLogChange([]);
    setStatus("Sent history cleared.");
  }

  function removeSentRecord(email: string, role: Role) {
    onSentLogChange(
      sentLog.filter((s) => sentKey(s.email, s.role) !== sentKey(email, role))
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>4. Send</h2>
        <span className="badge">
          {pending.length} pending · {alreadySent.active.length + alreadySent.history.length} sent
        </span>
      </div>
      <div className="panel-body">
        <p className="hint compact">
          Already sent are skipped · use Send anyway to resend
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
              sendList(pending, { force: false, label: "Sending pending" })
            }
            disabled={sending || pending.length === 0}
          >
            {sending
              ? `${progress.current}/${progress.total}`
              : `Send pending (${pending.length})`}
          </button>
          <button
            type="button"
            className="btn large"
            onClick={() =>
              sendList(alreadySent.active, {
                force: true,
                label: "Resending",
              })
            }
            disabled={sending || alreadySent.active.length === 0}
          >
            Send anyway ({alreadySent.active.length})
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
              <span className="chip">{pending.length}</span>
            </div>
            <div className="scroll-area send-scroll">
              {pending.length === 0 ? (
                <p className="hint">No pending emails</p>
              ) : (
                <ul className="results">
                  {pending.map((r) => (
                    <li key={r.id} className="pending">
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
              <h3>Already sent</h3>
              <div className="send-col-actions">
                <span className="chip">
                  {alreadySent.active.length + alreadySent.history.length}
                </span>
                {(alreadySent.active.length > 0 ||
                  alreadySent.history.length > 0) && (
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
              {alreadySent.active.length === 0 &&
              alreadySent.history.length === 0 ? (
                <p className="hint">Nothing sent yet</p>
              ) : (
                <ul className="results">
                  {alreadySent.active.map((r) => (
                    <li key={r.id} className="ok sent-row">
                      <span>
                        {r.title ? `${r.title} · ` : ""}
                        {r.email} · {ROLE_LABELS[r.role]}
                      </span>
                      <span className="sent-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={sending}
                          onClick={() =>
                            sendList([r], {
                              force: true,
                              label: "Resending one",
                            })
                          }
                        >
                          Send anyway
                        </button>
                        <button
                          type="button"
                          className="btn ghost danger"
                          disabled={sending}
                          onClick={() => removeSentRecord(r.email, r.role)}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                  {alreadySent.history.map((s) => (
                    <li
                      key={`${s.email}-${s.role}-${s.sentAt}`}
                      className="ok sent-row muted-row"
                    >
                      <span>
                        {s.title ? `${s.title} · ` : ""}
                        {s.email} · {ROLE_LABELS[s.role]}
                      </span>
                      <button
                        type="button"
                        className="btn ghost danger"
                        disabled={sending}
                        onClick={() => removeSentRecord(s.email, s.role)}
                      >
                        ×
                      </button>
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
