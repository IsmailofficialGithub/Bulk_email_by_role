"use client";

import { useState } from "react";
import {
  ROLE_LABELS,
  type Recipient,
  type Role,
  type RoleTemplate,
  type SendResult,
  type SmtpConfig,
} from "@/lib/types";

type Props = {
  config: SmtpConfig;
  recipients: Recipient[];
  templates: Record<Role, RoleTemplate>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SendPanel({ config, recipients, templates }: Props) {
  const [delaySec, setDelaySec] = useState(3);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<SendResult[]>([]);

  async function sendAll() {
    if (!config.configured) {
      setStatus("Configure and verify SMTP first.");
      return;
    }
    if (!recipients.length) {
      setStatus("Add at least one recipient.");
      return;
    }

    for (const role of new Set(recipients.map((r) => r.role))) {
      if (!templates[role].subject.trim()) {
        setStatus(`Subject missing for role: ${ROLE_LABELS[role]}`);
        return;
      }
    }

    setSending(true);
    setResults([]);
    setProgress({ current: 0, total: recipients.length });
    setStatus("Starting…");

    const collected: SendResult[] = [];
    const delayMs = Math.max(0, delaySec) * 1000;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const tpl = templates[recipient.role];

      setProgress({ current: i + 1, total: recipients.length });
      setStatus(`Sending to ${recipient.email} (${ROLE_LABELS[recipient.role]})…`);

      const formData = new FormData();
      formData.append("fromEmail", config.email);
      formData.append("appPassword", config.appPassword);
      formData.append("toEmail", recipient.email);
      formData.append("subject", tpl.subject);
      formData.append("content", tpl.content);
      tpl.files.forEach((file, idx) => {
        formData.append(`attachment_${idx}`, file);
      });

      try {
        const res = await fetch("/api/send", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        const result: SendResult = data.success
          ? { email: recipient.email, role: recipient.role, success: true }
          : {
              email: recipient.email,
              role: recipient.role,
              success: false,
              error: data.error || "Send failed",
            };
        collected.push(result);
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

      if (i < recipients.length - 1 && delayMs > 0) {
        setStatus(`Waiting ${delaySec}s before next email…`);
        await sleep(delayMs);
      }
    }

    const ok = collected.filter((r) => r.success).length;
    const fail = collected.length - ok;
    setStatus(`Done. Sent ${ok}, failed ${fail}.`);
    setSending(false);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>4. Send</h2>
      </div>

      <div className="add-row">
        <label className="field">
          <span>Delay between emails (seconds)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={delaySec}
            onChange={(e) => setDelaySec(Number(e.target.value) || 0)}
            disabled={sending}
          />
        </label>
        <button
          type="button"
          className="btn primary large"
          onClick={sendAll}
          disabled={sending}
        >
          {sending
            ? `Sending ${progress.current}/${progress.total}…`
            : `Send to all (${recipients.length})`}
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

      {results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={`${r.email}-${r.role}`} className={r.success ? "ok" : "err"}>
              <span>
                {r.email} · {ROLE_LABELS[r.role]}
              </span>
              <span>{r.success ? "Sent" : r.error}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
