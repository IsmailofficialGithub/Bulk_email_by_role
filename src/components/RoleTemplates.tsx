"use client";

import { useMemo } from "react";
import {
  ROLE_LABELS,
  ROLES,
  type Recipient,
  type Role,
  type RoleTemplate,
} from "@/lib/types";

type Props = {
  recipients: Recipient[];
  templates: Record<Role, RoleTemplate>;
  activeRole: Role;
  onActiveRoleChange: (role: Role) => void;
  onChange: (role: Role, patch: Partial<RoleTemplate>) => void;
};

export function RoleTemplates({
  recipients,
  templates,
  activeRole,
  onActiveRoleChange,
  onChange,
}: Props) {
  const counts = useMemo(() => {
    const map: Record<Role, number> = {
      devops: 0,
      fullstack: 0,
      "ai-automation": 0,
      custom: 0,
    };
    recipients.forEach((r) => {
      map[r.role] += 1;
    });
    return map;
  }, [recipients]);

  const tpl = templates[activeRole];

  function removeFile(index: number) {
    onChange(activeRole, {
      files: tpl.files.filter((_, i) => i !== index),
    });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>3. Templates</h2>
        <span className="badge">saved per role</span>
      </div>
      <div className="panel-body">
        <p className="hint compact">
          Settings stay saved when you switch roles · {"{{title}}"} {"{{email}}"}
        </p>

        <div className="role-tabs" role="tablist">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={activeRole === role}
              className={`role-tab${activeRole === role ? " active" : ""}${
                counts[role] > 0 ? " has-recipients" : ""
              }`}
              onClick={() => onActiveRoleChange(role)}
            >
              <span>{ROLE_LABELS[role]}</span>
              <span className="role-tab-count">{counts[role]}</span>
            </button>
          ))}
        </div>

        <div className="scroll-area template-editor">
          <div className="template-card single">
            <div className="template-head">
              <h3>{ROLE_LABELS[activeRole]}</h3>
              <span className="chip">
                {counts[activeRole]} recipient
                {counts[activeRole] === 1 ? "" : "s"}
              </span>
            </div>

            <label className="field">
              <span>Subject</span>
              <input
                type="text"
                value={tpl.subject}
                onChange={(e) =>
                  onChange(activeRole, { subject: e.target.value })
                }
                placeholder={`${ROLE_LABELS[activeRole]} subject`}
              />
            </label>

            <label className="field stretch">
              <span>Content</span>
              <textarea
                className="textarea-content"
                value={tpl.content}
                onChange={(e) =>
                  onChange(activeRole, { content: e.target.value })
                }
                placeholder="Email body for this role…"
              />
            </label>

            <div className="attach-block">
              <div className="attach-head">
                <span className="attach-label">
                  Attachments ({tpl.files.length})
                </span>
                <label className="btn attach-add">
                  {tpl.files.length === 0 ? "Add attachment" : "Add more"}
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const existing = new Set(
                        tpl.files.map((f) => `${f.name}:${f.size}:${f.lastModified}`)
                      );
                      const next = files.filter(
                        (f) =>
                          !existing.has(`${f.name}:${f.size}:${f.lastModified}`)
                      );
                      if (next.length) {
                        onChange(activeRole, {
                          files: [...tpl.files, ...next],
                        });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {tpl.files.length > 0 ? (
                <ul className="file-list tall">
                  {tpl.files.map((f, index) => (
                    <li key={`${f.name}-${f.size}-${index}`} title={f.name}>
                      <span>
                        {f.name}{" "}
                        <span className="muted">
                          ({Math.round(f.size / 1024)} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn ghost danger"
                        onClick={() => removeFile(index)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint compact">No files yet — add one or more</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
