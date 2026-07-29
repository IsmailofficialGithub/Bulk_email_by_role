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

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>3. Templates</h2>
        <span className="badge">{activeRoles.length || 0} roles</span>
      </div>
      <div className="panel-body">
        {activeRoles.length === 0 ? (
          <p className="hint">Add recipients with roles to edit templates</p>
        ) : (
          <>
            <p className="hint compact">
              Per-role subject / body / files · {"{{title}}"} {"{{email}}"}
            </p>
            <div className="scroll-area">
              <div className="templates">
                {activeRoles.map((role) => {
                  const tpl = templates[role];
                  const count = recipients.filter((r) => r.role === role).length;
                  return (
                    <div key={role} className="template-card">
                      <div className="template-head">
                        <h3>{ROLE_LABELS[role]}</h3>
                        <span className="chip">{count}</span>
                      </div>

                      <label className="field">
                        <span>Subject</span>
                        <input
                          type="text"
                          value={tpl.subject}
                          onChange={(e) =>
                            onChange(role, { subject: e.target.value })
                          }
                          placeholder={`${ROLE_LABELS[role]} subject`}
                        />
                      </label>

                      <label className="field stretch">
                        <span>Content</span>
                        <textarea
                          rows={3}
                          value={tpl.content}
                          onChange={(e) =>
                            onChange(role, { content: e.target.value })
                          }
                          placeholder="Email body…"
                        />
                      </label>

                      <label className="field">
                        <span>Attachments</span>
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
                            <li key={`${f.name}-${f.size}`} title={f.name}>
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
            </div>
          </>
        )}
      </div>
    </section>
  );
}
