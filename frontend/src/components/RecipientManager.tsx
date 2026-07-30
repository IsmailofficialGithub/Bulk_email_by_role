"use client";

import { useEffect, useMemo, useState } from "react";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";
import { extractEmails } from "@/lib/extractEmails";
import {
  ROLE_LABELS,
  ROLES,
  type Recipient,
  type Role,
  type AutoFetchConfig,
} from "@/lib/types";

type Props = {
  recipients: Recipient[];
  onChange: (recipients: Recipient[]) => void;
  defaultTitle: string;
  onDefaultTitleChange: (title: string) => void;
  autoFetch: AutoFetchConfig;
  onAutoFetchChange: (config: AutoFetchConfig) => void;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function RecipientManager({
  recipients,
  onChange,
  defaultTitle,
  onDefaultTitleChange,
  autoFetch,
  onAutoFetchChange,
}: Props) {
  
  // Add Manual
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [titleInput, setTitleInput] = useState(defaultTitle);
  const [role, setRole] = useState<Role>("fullstack");
  
  // Add JSON Extract
  const [jsonInput, setJsonInput] = useState("");
  const [jsonRole, setJsonRole] = useState<Role>("fullstack");
  const [jsonTitle, setJsonTitle] = useState(defaultTitle);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(50);
  
  const [hydratedTitle, setHydratedTitle] = useState(false);

  useEffect(() => {
    if (hydratedTitle) return;
    setTimeout(() => {
      setTitleInput(defaultTitle);
      setJsonTitle(defaultTitle);
      setHydratedTitle(true);
    }, 0);
  }, [defaultTitle, hydratedTitle]);

  const counts = useMemo(() => {
    const map: Record<Role, number> = {
      devops: 0,
      fullstack: 0,
      "ai-automation": 0,
      custom: 0,
    };
    recipients.forEach((r) => {
      if (map[r.role] !== undefined) {
        map[r.role] += 1;
      }
    });
    return map;
  }, [recipients]);

  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      if (filterStatus !== "all" && (r.status || "pending") !== filterStatus) return false;
      if (filterSource !== "all" && (r.source || "auto_fetch") !== filterSource) return false;
      if (filterRole !== "all" && r.role !== filterRole) return false;
      return true;
    });
  }, [recipients, filterStatus, filterSource, filterRole]);

  const visibleRecipients = filteredRecipients.slice(0, visibleCount);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      setVisibleCount((c) => Math.min(c + 50, filteredRecipients.length));
    }
  }

  function setDefaultFrom(title: string) {
    const next = title.trim();
    onDefaultTitleChange(next);
  }

  function addOne() {
    const email = emailInput.trim().toLowerCase();
    const phone = phoneInput.trim();
    const title = titleInput.trim() || defaultTitle.trim();
    if (!email && !phone) return;
    if (email && recipients.some((r) => r.email === email)) {
      setEmailInput("");
      return;
    }
    if (title) setDefaultFrom(title);
    onChange([...recipients, { 
      id: uid(), 
      email, 
      phone, 
      role, 
      title,
      status: 'pending',
      source: 'manual'
    }]);
    setEmailInput("");
    setPhoneInput("");
    // keep title as default for next recipient
    setTitleInput(title || defaultTitle);
  }

  function importJson() {
    const emails = extractEmails(jsonInput);
    if (!emails.length) return;
    const existing = new Set(recipients.map((r) => r.email).filter(Boolean));
    const next = [...recipients];
    const title = jsonTitle.trim() || defaultTitle.trim();
    if (title) setDefaultFrom(title);
    for (const email of emails) {
      if (existing.has(email)) continue;
      existing.add(email);
      next.push({ id: uid(), email, role: jsonRole, title, status: 'pending', source: 'manual' });
    }
    onChange(next);
    setJsonInput("");
    setJsonTitle(title || defaultTitle);
  }

  function remove(id: string) {
    onChange(recipients.filter((r) => r.id !== id));
  }

  function updateRole(id: string, nextRole: Role) {
    onChange(
      recipients.map((r) => (r.id === id ? { ...r, role: nextRole } : r))
    );
  }

  function updateTitle(id: string, title: string) {
    onChange(recipients.map((r) => (r.id === id ? { ...r, title } : r)));
    if (title.trim()) setDefaultFrom(title);
  }

  function updateStatus(id: string, status: "pending" | "sent" | "failed") {
    onChange(recipients.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>2. Recipients</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span className="badge">{recipients.length} total</span>
        </div>
      </div>
      <div className="panel-body">
        <div className="role-counts" style={{ marginBottom: "1rem" }}>
          {ROLES.map((r) => (
            <span key={r} className="chip">
              {ROLE_LABELS[r]}: {counts[r]}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", background: "var(--bg-elevated)", padding: "0.5rem", borderRadius: "6px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--fg-dim)", fontWeight: 500 }}>Filters:</span>
          
          <select 
            value={filterRole} 
            onChange={(e) => { setFilterRole(e.target.value); setVisibleCount(50); }}
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem", borderRadius: "4px", border: "1px solid var(--line)", background: "var(--bg)" }}
          >
            <option value="all">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          
          <select 
            value={filterStatus} 
            onChange={(e) => { setFilterStatus(e.target.value); setVisibleCount(50); }}
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem", borderRadius: "4px", border: "1px solid var(--line)", background: "var(--bg)" }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          
          <select 
            value={filterSource} 
            onChange={(e) => { setFilterSource(e.target.value); setVisibleCount(50); }}
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem", borderRadius: "4px", border: "1px solid var(--line)", background: "var(--bg)" }}
          >
            <option value="all">All Sources</option>
            <option value="auto_fetch">Auto-Fetch</option>
            <option value="manual">Manual Add</option>
          </select>
          
          <button 
            type="button" 
            className="btn" 
            style={{ marginLeft: "auto", background: "var(--bg-error)", color: "black", padding: "0.25rem 0.75rem", fontSize: "0.85rem", height: "auto" }}
            onClick={() => {
              if (confirm("Are you sure you want to delete all pending recipients?")) {
                onChange(recipients.filter(r => (r.status || 'pending') !== 'pending'));
              }
            }}
          >
            Clear All Pending
          </button>
        </div>

        <div className="add-row">
          <label className="field grow">
            <span>Title (saved as default)</span>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={() => setDefaultFrom(titleInput)}
              placeholder="Name / title"
            />
          </label>
          <label className="field grow">
            <span>Email</span>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }}
              placeholder="email@company.com"
            />
          </label>
          <label className="field grow">
            <span>Phone</span>
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }}
              placeholder="+1234567890"
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <button type="button" className="btn" onClick={addOne}>Add</button>
        </div>

        <label className="field json-row">
          <span>JSON / text extract (comma, space, or JSON)</span>
          <AutoGrowTextarea
            className="textarea-json"
            value={jsonInput}
            maxHeight={260}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`a@x.com, b@y.com\nor a@x.com b@y.com\nor ["a@x.com","b@y.com"]`}
          />
        </label>
        <div className="add-row">
          <label className="field grow">
            <span>Import title (uses default)</span>
            <input
              type="text"
              value={jsonTitle}
              onChange={(e) => setJsonTitle(e.target.value)}
              onBlur={() => setDefaultFrom(jsonTitle)}
              placeholder={defaultTitle || "Optional"}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={jsonRole}
              onChange={(e) => setJsonRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={importJson}>
            Extract
          </button>
        </div>

        <div className="scroll-area" onScroll={handleScroll} style={{ maxHeight: "400px", overflowY: "auto" }}>
          {visibleRecipients.length > 0 ? (
            <ul className="recipient-list">
              {visibleRecipients.map((r) => (
                <li key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", padding: "0.5rem", borderBottom: "1px solid var(--line)" }}>
                  
                  <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <input
                      className="title-inline"
                      type="text"
                      value={r.title}
                      onChange={(e) => updateTitle(r.id, e.target.value)}
                      placeholder={defaultTitle || "Title"}
                      style={{ fontSize: "0.85rem", padding: "0.1rem 0.25rem", background: "transparent", border: "none" }}
                      aria-label="Email title"
                    />
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className="badge" style={{ fontSize: "0.7rem", backgroundColor: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                        {r.source === 'manual' ? 'Manual' : 'Auto'}
                      </span>
                      {r.email && <span className="email" style={{ fontSize: "0.75rem", fontWeight: 600 }}>{r.email}</span>}
                      {r.phone && <span className="phone" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>📞 {r.phone}</span>}
                    </div>
                  </div>

                  <div style={{ flex: "0 0 auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      value={r.status || "pending"}
                      onChange={(e) => updateStatus(r.id, e.target.value as any)}
                      style={{ fontSize: "0.75rem", padding: "0.15rem", borderRadius: "4px" }}
                    >
                      <option value="pending">Pending</option>
                      <option value="sent">Sent</option>
                      <option value="failed">Failed</option>
                    </select>

                    <select
                      value={r.role}
                      onChange={(e) => updateRole(r.id, e.target.value as Role)}
                      style={{ fontSize: "0.75rem", padding: "0.15rem", borderRadius: "4px" }}
                    >
                      {ROLES.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {ROLE_LABELS[roleOption]}
                        </option>
                      ))}
                    </select>
                    
                    <button type="button" className="btn ghost danger" onClick={() => remove(r.id)} style={{ padding: "0.2rem 0.5rem" }}>
                      ×
                    </button>
                  </div>
                </li>
              ))}
              {filteredRecipients.length > visibleCount && (
                <div style={{ padding: "1rem", textAlign: "center", color: "var(--muted)", fontSize: "0.8rem" }}>
                  Scroll down to load more...
                </div>
              )}
            </ul>
          ) : (
            <p className="hint">No recipients match filters</p>
          )}
        </div>
      </div>
    </section>
  );
}
