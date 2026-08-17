import React, { useState, useMemo, useEffect } from "react";
import { type CommentRecord } from "@/lib/types";

interface CommentsTabProps {
  comments: CommentRecord[];
}

export function CommentsTab({ comments }: CommentsTabProps) {
  const [filter, setFilter] = useState<"all" | "sent" | "failed">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredComments = useMemo(() => {
    if (filter === "all") return comments;
    return comments.filter(c => filter === "sent" ? c.status === "sent" : c.status !== "sent");
  }, [comments, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredComments.length / itemsPerPage));
  const currentItems = filteredComments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  if (comments.length === 0) {
    return (
      <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
        <p className="hint">No comments have been sent yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={`btn small ${filter === 'all' ? 'primary' : 'ghost'}`} onClick={() => setFilter('all')}>All</button>
          <button className={`btn small ${filter === 'sent' ? 'primary' : 'ghost'}`} onClick={() => setFilter('sent')}>Sent</button>
          <button className={`btn small ${filter === 'failed' ? 'primary' : 'ghost'}`} onClick={() => setFilter('failed')}>Failed</button>
        </div>
        <span className="hint compact">Showing {currentItems.length} of {filteredComments.length}</span>
      </div>

      {currentItems.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <p className="hint">No comments found for this filter.</p>
        </div>
      ) : (
        currentItems.map((c) => (
        <div key={c.id} className="card" style={{ padding: "1.5rem", borderLeft: c.status === 'sent' ? '4px solid var(--ok)' : '4px solid var(--err)' }}>
          
          {/* Header Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span className={`badge ${c.status === "sent" ? "ok" : "err"}`}>
                {c.status.toUpperCase()}
              </span>
              <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                {new Date(c.sentAt).toLocaleString()}
              </span>
            </div>
            
            <a href={c.postUrl} target="_blank" rel="noopener noreferrer" className="btn ghost small" style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              View Post <span>↗</span>
            </a>
          </div>
          
          {/* Comment Body */}
          <div style={{ background: "var(--bg)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Generated Comment
            </h4>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--fg)", lineHeight: "1.6", fontSize: "0.95rem" }}>
              {c.commentText}
            </div>
          </div>

          {/* Error State */}
          {c.error && c.status !== 'sent' && (
            <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(255, 59, 48, 0.05)", borderRadius: "8px", border: "1px solid rgba(255, 59, 48, 0.2)" }}>
              <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "var(--err)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Failure Reason
              </h4>
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--err)", fontSize: "0.85rem", lineHeight: "1.5" }}>
                {c.error}
              </div>
            </div>
          )}

        </div>
      )))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
          <button 
            className="btn ghost small" 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="hint compact">Page {currentPage} of {totalPages}</span>
          <button 
            className="btn ghost small" 
            disabled={currentPage === totalPages} 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
