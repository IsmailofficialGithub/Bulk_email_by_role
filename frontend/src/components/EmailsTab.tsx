"use client";

import { useMemo, useState } from "react";
import { ROLE_LABELS, type Recipient, type Role } from "@/lib/types";

type Props = {
  recipients: Recipient[];
  onUpdateStatus?: (id: string, field: 'status' | 'phone_status', newStatus: string) => Promise<void>;
};

export function EmailsTab({ recipients, onUpdateStatus }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPhoneStatus, setFilterPhoneStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  const [filterContactType, setFilterContactType] = useState<string>("all");

  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      if (filterStatus !== "all" && (r.status || "pending") !== filterStatus) return false;
      if (filterPhoneStatus !== "all" && (r.phone_status || "pending") !== filterPhoneStatus) return false;
      if (filterSource !== "all" && (r.source || "auto_fetch") !== filterSource) return false;
      if (filterRole !== "all" && r.role !== filterRole) return false;
      
      if (filterContactType === "has_phone" && !r.phone) return false;
      if (filterContactType === "has_email" && !r.email) return false;
      if (filterContactType === "phone_only" && (!r.phone || r.email)) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const em = (r.email || "").toLowerCase();
        const ph = (r.phone || "").toLowerCase();
        const ti = (r.title || "").toLowerCase();
        if (!em.includes(q) && !ph.includes(q) && !ti.includes(q)) return false;
      }
      return true;
    });
  }, [recipients, filterStatus, filterPhoneStatus, filterSource, filterRole, filterContactType, searchQuery]);

  const visibleRecipients = filteredRecipients.slice(0, visibleCount);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      setVisibleCount((c) => Math.min(c + 50, filteredRecipients.length));
    }
  }

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="card-header" style={{ paddingBottom: "0.5rem" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Emails Database
          </h2>
          <p className="hint">A complete overview of all contacts, leads, and emails across your entire system.</p>
        </div>
      </div>

      <div style={{ padding: "0 1.5rem 1rem 1.5rem", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search email, phone, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ minWidth: "250px", flex: 1 }}
          />
          <select value={filterContactType} onChange={(e) => setFilterContactType(e.target.value)}>
            <option value="all">All Contacts</option>
            <option value="has_email">Has Email</option>
            <option value="has_phone">Has Phone</option>
            <option value="phone_only">Phone Only (No Email)</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Email Status (All)</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <select value={filterPhoneStatus} onChange={(e) => setFilterPhoneStatus(e.target.value)}>
            <option value="all">Phone Status (All)</option>
            <option value="pending">Pending</option>
            <option value="sent">Msg Sent</option>
            <option value="wrong_number">Wrong Number</option>
          </select>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="auto_fetch">Auto-Fetch (Scraped)</option>
            <option value="manual">Manual Entry</option>
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">All Roles</option>
            {Object.keys(ROLE_LABELS).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r as Role]}</option>
            ))}
          </select>
        </div>
      </div>

      <div 
        style={{ flex: 1, overflowY: "auto", padding: "1.5rem", background: "var(--bg-panel)" }} 
        onScroll={handleScroll}
      >
        {visibleRecipients.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", fontStyle: "italic" }}>
            No emails found matching your filters.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "1rem 0.75rem", color: "var(--muted)", fontWeight: 500, width: "35%" }}>Contact</th>
                <th style={{ textAlign: "left", padding: "1rem 0.75rem", color: "var(--muted)", fontWeight: 500, width: "25%" }}>Role & Title</th>
                <th style={{ textAlign: "left", padding: "1rem 0.75rem", color: "var(--muted)", fontWeight: 500, width: "15%" }}>Email Status</th>
                <th style={{ textAlign: "left", padding: "1rem 0.75rem", color: "var(--muted)", fontWeight: 500, width: "15%" }}>Phone Status</th>
                <th style={{ textAlign: "left", padding: "1rem 0.75rem", color: "var(--muted)", fontWeight: 500, width: "10%" }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecipients.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    <div style={{ fontWeight: 500, color: "var(--fg)" }}>{r.email || <span style={{color: "var(--muted)", fontStyle: "italic"}}>No Email</span>}</div>
                    {r.phone && <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.25rem" }}>{r.phone}</div>}
                  </td>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    <div style={{ display: "inline-block", background: "var(--bg)", border: "1px solid var(--line)", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", color: "var(--accent)", fontWeight: 500 }}>
                      {ROLE_LABELS[r.role]}
                    </div>
                    {r.title && <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.4rem" }}>{r.title}</div>}
                    {(r.scraped_at || r.source_url) && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.4rem" }}>
                        {r.scraped_at && <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Scraped: {new Date(r.scraped_at).toLocaleDateString()}</span>}
                        {r.source_url && (
                          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                            {r.source_url.split(',').map((url, i) => (
                              <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.65rem", color: "var(--accent)", textDecoration: "underline" }}>
                                [Post {i + 1}]
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    {r.status === "sent" ? (
                      <span style={{ color: "var(--ok)", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--ok)" }}></span> Sent
                      </span>
                    ) : r.status === "failed" ? (
                      <span style={{ color: "var(--err)", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--err)" }}></span> Failed
                      </span>
                    ) : (
                      <span style={{ color: "var(--warn)", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--warn)" }}></span> Pending
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    {!r.phone ? (
                      <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "0.85rem" }}>No Phone</span>
                    ) : (
                      <select
                        value={r.phone_status || "pending"}
                        onChange={(e) => onUpdateStatus?.(r.id, 'phone_status', e.target.value)}
                        style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          border: "1px solid var(--line)",
                          background: "var(--bg)",
                          color: r.phone_status === "sent" ? "var(--ok)" : r.phone_status === "wrong_number" ? "var(--err)" : "var(--warn)",
                          fontWeight: 500,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          outline: "none"
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="sent">Msg Sent</option>
                        <option value="wrong_number">Wrong Number</option>
                      </select>
                    )}
                  </td>
                  <td style={{ padding: "1rem 0.75rem" }}>
                    {r.source === "manual" ? (
                      <span style={{ color: "var(--fg)", fontSize: "0.85rem" }}>Manual Entry</span>
                    ) : (
                      <span style={{ color: "var(--accent)", fontSize: "0.85rem" }}>Auto-Scraped</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card-footer" style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--line)", color: "var(--muted)", fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
        <span>Showing {visibleRecipients.length} of {filteredRecipients.length} filtered results</span>
        <span>Total Contacts: {recipients.length}</span>
      </div>
    </div>
  );
}
