"use client";

import { useMemo } from "react";
import {
  ROLE_LABELS,
  type Recipient,
  type Role,
  type RoleTemplate,
} from "@/lib/types";

type Props = {
  recipients: Recipient[];
  templates: Record<Role, RoleTemplate>;
  onChange: (role: Role, patch: Partial<RoleTemplate>) => void;
};

export function RoleTemplates({ recipients, templates, onChange }: Props) {
  const activeRoles = useMemo(() => {
    const set = new Set<Role>();
    recipients.forEach((r) => set.add(r.role));
    return Array.from(set);
  }, [recipients]);

  if (activeRoles.length === 0) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>3. Role Templates</h2>
        </div>
        <p className="hint">
          Add recipients with roles first. Each role gets its own subject,
          content, and attachments.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>3. Role Templates</h2>
        <span className="badge">{activeRoles.length} roles</span>
      </div>
      <p className="hint">
        Set subject, body, and attachments separately for each role that has
        recipients.
      </p>

      <div className="templates">
        {activeRoles.map((role) => {
          const tpl = templates[role];
          const count = recipients.filter((r) => r.role === role).length;
          return (
            <div key={role} className="template-card">
              <div className="template-head">
                <h3>{ROLE_LABELS[role]}</h3>
                <span className="chip">{count} recipient(s)</span>
              </div>

              <label className="field">
                <span>Subject</span>
                <input
                  type="text"
                  value={tpl.subject}
                  onChange={(e) => onChange(role, { subject: e.target.value })}
                  placeholder={`Application for ${ROLE_LABELS[role]} role`}
                />
              </label>

              <label className="field">
                <span>Content</span>
                <textarea
                  rows={6}
                  value={tpl.content}
                  onChange={(e) => onChange(role, { content: e.target.value })}
                  placeholder="Email body for this role…"
                />
              </label>

              <label className="field">
                <span>Attachments (multiple)</span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    onChange(role, { files });
                  }}
                />
              </label>

              {tpl.files.length > 0 && (
                <ul className="file-list">
                  {tpl.files.map((f) => (
                    <li key={`${f.name}-${f.size}`}>
                      {f.name}{" "}
                      <span className="muted">
                        ({Math.round(f.size / 1024)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
