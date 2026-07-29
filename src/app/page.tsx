"use client";

import { useEffect, useState } from "react";
import { RecipientManager } from "@/components/RecipientManager";
import { RoleTemplates } from "@/components/RoleTemplates";
import { SendPanel } from "@/components/SendPanel";
import { SmtpConfigPanel } from "@/components/SmtpConfigPanel";
import {
  clearState,
  defaultState,
  loadState,
  saveState,
  templatesFromStored,
  type PersistedState,
} from "@/lib/storage";
import {
  ROLES,
  type Recipient,
  type Role,
  type RoleTemplate,
  type SmtpConfig,
} from "@/lib/types";

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<SmtpConfig>(defaultState().config);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<Record<Role, RoleTemplate>>(
    templatesFromStored(defaultState().templates)
  );
  const [delaySec, setDelaySec] = useState(3);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const saved = loadState();
    setConfig(saved.config);
    setRecipients(saved.recipients);
    setTemplates(templatesFromStored(saved.templates));
    setDelaySec(saved.delaySec);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedState = {
      config,
      recipients,
      templates: ROLES.reduce(
        (acc, role) => {
          acc[role] = {
            subject: templates[role].subject,
            content: templates[role].content,
          };
          return acc;
        },
        {} as PersistedState["templates"]
      ),
      delaySec,
    };
    saveState(payload);
  }, [hydrated, config, recipients, templates, delaySec]);

  function updateTemplate(role: Role, patch: Partial<RoleTemplate>) {
    setTemplates((prev) => ({
      ...prev,
      [role]: { ...prev[role], ...patch },
    }));
  }

  function resetAll() {
    clearState();
    const fresh = defaultState();
    setConfig(fresh.config);
    setRecipients([]);
    setTemplates(templatesFromStored(fresh.templates));
    setDelaySec(fresh.delaySec);
  }

  if (!hydrated) {
    return (
      <main className="page">
        <p className="status-line">Loading saved settings…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="brand">AutoMailSend</p>
        <h1>Bulk email by role</h1>
        <p className="lede">
          Configure SMTP, add recipients with roles, set per-role content and
          attachments, then send with delay. Progress is saved in this browser.
        </p>
      </header>

      <div className="stack">
        <SmtpConfigPanel
          config={config}
          onChange={setConfig}
          onResetAll={resetAll}
        />
        <RecipientManager recipients={recipients} onChange={setRecipients} />
        <RoleTemplates
          recipients={recipients}
          templates={templates}
          onChange={updateTemplate}
        />
        <SendPanel
          config={config}
          recipients={recipients}
          templates={templates}
          delaySec={delaySec}
          onDelayChange={setDelaySec}
          sending={sending}
          onSendingChange={setSending}
        />
      </div>

      <footer className="foot">
        Roles: {ROLES.join(" · ")} · Powered by Nodemailer + Next.js API
      </footer>
    </main>
  );
}
