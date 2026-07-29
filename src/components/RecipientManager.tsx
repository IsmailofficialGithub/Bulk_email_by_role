"use client";

import { useMemo, useState } from "react";
import { extractEmails } from "@/lib/extractEmails";
import {
  ROLE_LABELS,
  ROLES,
  type Recipient,
  type Role,
} from "@/lib/types";

type Props = {
  recipients: Recipient[];
  onChange: (recipients: Recipient[]) => void;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function RecipientManager({ recipients, onChange }: Props) {
  const [emailInput, setEmailInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [role, setRole] = useState<Role>("fullstack");
  const [jsonInput, setJsonInput] = useState("");
  const [jsonRole, setJsonRole] = useState<Role>("fullstack");
  const [jsonTitle, setJsonTitle] = useState("");

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

  function addOne() {
    const email = emailInput.trim().toLowerCase();
    const title = titleInput.trim();
    if (!email || !email.includes("@")) return;
    if (recipients.some((r) => r.email === email)) {
      setEmailInput("");
      setTitleInput("");
      return;
    }
    onChange([...recipients, { id: uid(), email, role, title }]);
    setEmailInput("");
    setTitleInput("");
  }

  function importJson() {
    const emails = extractEmails(jsonInput);
    if (!emails.length) return;
    const existing = new Set(recipients.map((r) => r.email));
    const next = [...recipients];
    const title = jsonTitle.trim();
    for (const email of emails) {
      if (existing.has(email)) continue;
      existing.add(email);
      next.push({ id: uid(), email, role: jsonRole, title });
    }
    onChange(next);
    setJsonInput("");
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
    onChange(
      recipients.map((r) => (r.id === id ? { ...r, title } : r))
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>2. Recipients</h2>
        <span className="badge">{recipients.length} total</span>
      </div>

      <div className="role-counts">
        {ROLES.map((r) => (
          <span key={r} className="chip">
            {ROLE_LABELS[r]}: {counts[r]}
          </span>
        ))}
      </div>

      <div className="add-row">
        <label className="field grow">
          <span>Email title</span>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="e.g. John Doe / Senior Engineer"
          />
        </label>
        <label className="field grow">
          <span>Add email</span>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOne();
              }
            }}
            placeholder="candidate@company.com"
          />
        </label>
        <label className="field">
          <span>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={addOne}>
          Add
        </button>
      </div>

      <label className="field">
        <span>Paste JSON / text (auto-extract emails)</span>
        <textarea
          rows={4}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={`["a@x.com","b@y.com"]\nor\n[{"email":"a@x.com"},{"email":"b@y.com"}]`}
        />
      </label>
      <div className="add-row">
        <label className="field grow">
          <span>Title for imported emails</span>
          <input
            type="text"
            value={jsonTitle}
            onChange={(e) => setJsonTitle(e.target.value)}
            placeholder="Optional shared title"
          />
        </label>
        <label className="field">
          <span>Assign role</span>
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
          Extract & Add
        </button>
      </div>

      {recipients.length > 0 && (
        <ul className="recipient-list">
          {recipients.map((r) => (
            <li key={r.id}>
              <input
                className="title-inline"
                type="text"
                value={r.title}
                onChange={(e) => updateTitle(r.id, e.target.value)}
                placeholder="Title"
                aria-label="Email title"
              />
              <span className="email">{r.email}</span>
              <select
                value={r.role}
                onChange={(e) => updateRole(r.id, e.target.value as Role)}
              >
                {ROLES.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {ROLE_LABELS[roleOption]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => remove(r.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
