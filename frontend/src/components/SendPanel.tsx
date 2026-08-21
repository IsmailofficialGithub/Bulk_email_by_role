"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  AutomailConfig,
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
  automail: AutomailConfig;
  onAutomailChange: (automail: AutomailConfig) => void;
  sentTodayCount: number;
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

function formatFriendlyError(errorMsg?: string) {
  if (!errorMsg) return "Unknown error occurred.";
  const msg = errorMsg.toLowerCase();
  if (msg.includes("auth") || msg.includes("credentials") || msg.includes("password") || msg.includes("535")) {
    return "Invalid email password or app password.";
  }
  if (msg.includes("network") || msg.includes("timeout") || msg.includes("econnrefused")) {
    return "Could not connect to the email server. Please check your internet connection.";
  }
  if (msg.includes("rejected") || msg.includes("spam") || msg.includes("bounce")) {
    return "The recipient's server rejected the email (possibly marked as spam or invalid address).";
  }
  if (msg.includes("limit") || msg.includes("quota")) {
    return "You have reached your email provider's sending limit.";
  }
  return "Something went wrong while sending this email.";
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
  sentTodayCount
}: Props) {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"none" | "asc" | "desc">("none");
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [previewEmail, setPreviewEmail] = useState<SentRecord | null>(null);
  const abortRef = useRef(false);
  const initialSentCount = useRef(0);
  const expectedTotal = useRef(0);

  useEffect(() => {
    if (sending && expectedTotal.current > 0) {
      const processed = Math.max(0, sentLog.length - initialSentCount.current);
      setProgress({ current: processed, total: expectedTotal.current });
      
      if (processed >= expectedTotal.current) {
        onSendingChange(false);
        setStatus("All emails processed.");
        toast.success("Finished sending batch.");
        expectedTotal.current = 0;
      }
    }
  }, [sentLog.length, sending]);

  const toggleError = (key: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sentKeys = useMemo(
    () => new Set(sentLog.filter(s => s.status === "sent" || s.status === "skipped").map((s) => sentKey(s.email, s.role))),
    [sentLog]
  );

  function filterAndSort<T extends { email: string; title?: string }>(list: T[]) {
    let result = list;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.email.toLowerCase().includes(q) || 
        (item.title && item.title.toLowerCase().includes(q))
      );
    }
    if (sortOrder !== "none") {
      result = [...result].sort((a, b) => {
        const aVal = (a.title || a.email).toLowerCase();
        const bVal = (b.title || b.email).toLowerCase();
        if (sortOrder === "asc") {
          return aVal.localeCompare(bVal);
        } else {
          return bVal.localeCompare(aVal);
        }
      });
    }
    return result;
  }

  const pending = useMemo(
    () =>
      filterAndSort(recipients.filter((r) => !sentKeys.has(sentKey(r.email, r.role)))),
    [recipients, sentKeys, searchQuery, sortOrder]
  );
  
  const selectedPending = useMemo(
    () => pending.filter(r => selectedIds.has(r.id)),
    [pending, selectedIds]
  );

  const activeSent = useMemo(() => {
    return filterAndSort(recipients.filter((r) => sentKeys.has(sentKey(r.email, r.role))));
  }, [recipients, sentKeys, searchQuery, sortOrder]);

  const displayedSentLog = useMemo(() => filterAndSort(sentLog), [sentLog, searchQuery, sortOrder]);

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
    options: { force: boolean; label: string; mode: "ai" | "template" }
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

    abortRef.current = false;
    onSendingChange(true);
    setProgress({ current: 0, total: list.length });
    setStatus(`Preparing to send ${list.length} emails…`);

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

      initialSentCount.current = sentLog.length;
      expectedTotal.current = toProcess.length;

      // Update config with batchMode and batchTargetIds
      const updatedConfig = { ...config, batchMode: options.mode, batchTargetIds: list.length === recipients.length ? null : list.map(r => r.id) };

      const { error } = await supabase
        .from("automailsend_app_state")
        .update({ batch_send_pending: true, batch_send_processing: false, config: updatedConfig })
        .eq("user_id", userId);

      if (error) {
        setStatus("Failed to start batch.");
        toast.error(error.message || "Failed to update database.");
        onSendingChange(false);
      } else {
        setStatus("Background send started! Tracking progress...");
        toast.success("Background send started!");
      }
    } catch {
      setStatus("Network error queuing batch.");
      toast.error("Network error queuing batch.");
      onSendingChange(false);
    }
  }

  async function stopBackendBatch() {
    abortRef.current = true;
    setStatus("Stopping soon...");
    
    try {
      const { error } = await supabase
        .from("automailsend_app_state")
        .update({ batch_send_pending: false, batch_send_processing: false })
        .eq("user_id", userId);

      if (error) throw error;
      
      toast.success("Stop command sent. Ending loop...");
      onSendingChange(false);
      expectedTotal.current = 0;
    } catch {
      toast.error("Failed to send stop command.");
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

  async function deleteSelectedPending() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected pending email(s)?`)) return;
    
    const idsToDelete = Array.from(selectedIds);
    const { error } = await supabase.from('automailsend_recipients').delete().in('id', idsToDelete);
    if (error) {
      toast.error("Failed to delete selected items");
      console.error(error);
    } else {
      toast.success(`Deleted ${idsToDelete.length} pending emails`);
      setSelectedIds(new Set());
    }
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

        {sentTodayCount >= automail.dailyLimit && (
          <div style={{ padding: '0.75rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
            You have reached your daily limit of <strong>{automail.dailyLimit}</strong> emails. Background and manual sending are paused until tomorrow.
          </div>
        )}

        <div className="add-row">
          <label className="field grow">
            <span>Delay (sec)</span>
            <input
              type="number"
              min={0}
              max={3600}
              step={1}
              value={delaySec}
              onChange={(e) => onDelayChange(Number(e.target.value) || 0)}
              disabled={sending}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Same as Automail per-mail delay · recommended 60–180s
            </span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn primary large"
              onClick={() =>
                sendList(pending, { force: false, label: "Sending all pending (Template)", mode: "template" })
              }
              disabled={sending || pending.length === 0 || sentTodayCount >= automail.dailyLimit}
            >
              {sending
                ? `${progress.current}/${progress.total}`
                : pending.length === 0 ? "All Sent" : `Send All (${pending.length}) - Template`}
            </button>
            <button
              type="button"
              className="btn large"
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', opacity: (!automail.enabled || sentTodayCount >= automail.dailyLimit) ? 0.6 : 1 }}
              onClick={() =>
                sendList(pending, { force: false, label: "Sending all pending (AI)", mode: "ai" })
              }
              disabled={sending || pending.length === 0 || !automail.enabled || sentTodayCount >= automail.dailyLimit}
              title={automail.enabled ? "Send personalized emails with AI" : "Enable AI Automail in Settings first"}
            >
              {sending
                ? `${progress.current}/${progress.total}`
                : pending.length === 0 ? "All Sent" : `Send All (${pending.length}) - AI`}
            </button>
          </div>
        </div>

        <div className="card-header actions-bar">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn large"
              onClick={() =>
                sendList(selectedPending, { force: false, label: "Sending selected", mode: "template" })
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
                sendList(selectedPending, { force: false, label: "Sending selected (AI)", mode: "ai" })
              }
              disabled={sending || selectedPending.length === 0 || !automail.enabled}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
            >
              Send Selected (AI)
            </button>
          </div>
          <button
            type="button"
            className="btn large"
            onClick={() =>
              sendList(activeSent, {
                force: true,
                label: "Resending",
                mode: "template"
              })
            }
            disabled={sending || activeSent.length === 0}
          >
            Resend successful ({activeSent.length})
          </button>
            {sending && (
              <button
                type="button"
                className="btn large danger ghost"
                style={{ marginLeft: 'auto', border: '1px solid var(--danger)', background: 'var(--bg-elevated)' }}
                onClick={stopBackendBatch}
              >
                Stop Sending
              </button>
            )}
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

        <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0' }}>
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-elevated)', color: 'var(--fg)' }}
          />
          <select 
            value={sortOrder} 
            onChange={e => setSortOrder(e.target.value as any)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-elevated)', color: 'var(--fg)', minWidth: '150px' }}
          >
            <option value="none">No Sort</option>
            <option value="asc">A to Z</option>
            <option value="desc">Z to A</option>
          </select>
        </div>

        <div className="send-columns">
          <div className="send-col">
            <div className="send-col-head" style={{ alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start' }}>
              <input 
                type="checkbox"
                checked={pending.length > 0 && selectedIds.size === pending.length}
                onChange={toggleSelectAllPending}
                disabled={sending || pending.length === 0}
                style={{ cursor: 'pointer' }}
                title="Select all pending emails"
              />
              <h3 style={{ margin: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Pending 
                <span className="chip" style={{ fontWeight: 'normal' }}>{pending.length}</span>
              </h3>
              <div className="send-col-actions">
                {selectedIds.size > 0 && (
                  <button type="button" className="btn ghost danger" onClick={deleteSelectedPending} disabled={sending} style={{ padding: '0.1rem 0.5rem' }}>
                    Delete
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
              <h3>Skipped</h3>
              <div className="send-col-actions">
                <span className="chip">
                  {activeSent.length} skipped
                </span>
              </div>
            </div>
            <div className="scroll-area send-scroll">
              {activeSent.length === 0 ? (
                <p className="hint">None skipped</p>
              ) : (
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
                          sendList([r], { force: true, label: "Resending one", mode: "template" })
                        }
                      >
                        Resend
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="send-col">
            <div className="send-col-head">
              <h3>All History</h3>
              <div className="send-col-actions">
                <span className="chip">
                  {displayedSentLog.length} logs
                </span>
                {displayedSentLog.length > 0 && (
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
              {displayedSentLog.length === 0 ? (
                <p className="hint">No history yet</p>
              ) : (
                <ul className="results">
                  {displayedSentLog.map((s, idx) => {
                    const itemKey = `${s.email}-${s.role}-${s.sentAt}-${idx}`;
                    const isExpanded = expandedErrors.has(itemKey);
                    return (
                    <li
                      key={itemKey}
                      className={s.status === "failed" ? "err sent-row" : "ok sent-row"}
                      title={s.status !== "failed" ? s.status : undefined}
                      style={s.status === "failed" ? { flexDirection: 'column', alignItems: 'flex-start', padding: '0.5rem' } : {}}
                    >
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          {s.title ? `${s.title} · ` : ""}
                          {s.email} · {ROLE_LABELS[s.role]}
                        </span>
                        <span className="sent-actions">
                          <span className={`badge ${s.status === "failed" ? "danger" : "ok"}`} style={{ marginRight: '0.5rem' }}>
                            {s.status}
                          </span>
                          {(s.subject || s.body) && (
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ padding: '0', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '0.2rem', borderRadius: '50%' }}
                              onClick={() => setPreviewEmail(s)}
                              title="Preview email"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            </button>
                          )}
                          {s.status === "failed" && (
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ padding: '0', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '0.2rem', borderRadius: '50%' }}
                              onClick={() => toggleError(itemKey)}
                              title={isExpanded ? "Hide details" : "View details"}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn ghost danger"
                            disabled={sending}
                            onClick={() => removeSentRecord(s.email, s.role)}
                          >
                            ×
                          </button>
                        </span>
                      </div>
                      {s.status === "failed" && isExpanded && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.35rem', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', padding: '0.4rem', borderRadius: '4px', width: '100%' }}>
                          <strong>Reason:</strong> {formatFriendlyError(s.error)}
                          {s.error && <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: '0.2rem', wordBreak: 'break-all' }}>Technical info: {s.error}</div>}
                        </div>
                      )}
                    </li>
                  )})}
                </ul>
              )}
            </div>
          </div>
      </div>
      </div>
      
      {previewEmail && (
        <div className="modal-overlay" onClick={() => setPreviewEmail(null)}>
          <div className="modal" style={{ maxWidth: '600px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sent Email Preview</h2>
              <button className="close-btn" onClick={() => setPreviewEmail(null)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--muted)' }}>To:</strong> {previewEmail.email}
              </div>
              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}>
                <strong style={{ color: 'var(--muted)' }}>Subject:</strong> {previewEmail.subject || "(No Subject)"}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--fg)' }}>
                {previewEmail.body || "(No Body)"}
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '1rem', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setPreviewEmail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
