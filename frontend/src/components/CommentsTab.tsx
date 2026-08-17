import React from "react";
import { type CommentRecord } from "@/lib/types";

interface CommentsTabProps {
  comments: CommentRecord[];
}

export function CommentsTab({ comments }: CommentsTabProps) {
  if (comments.length === 0) {
    return (
      <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
        <p className="hint">No comments have been sent yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Sent At</th>
              <th>Status</th>
              <th>Post URL</th>
              <th>Comment Text</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((c) => (
              <tr key={c.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(c.sentAt).toLocaleString()}</td>
                <td>
                  <span className={`badge ${c.status === "sent" ? "ok" : "err"}`}>
                    {c.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  <a href={c.postUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                    View Post
                  </a>
                </td>
                <td style={{ maxWidth: "400px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {c.commentText}
                </td>
                <td style={{ color: "var(--err)", fontSize: "0.85rem" }}>
                  {c.error || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
