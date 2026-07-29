"use client";

import { useEffect, useRef, useState } from "react";
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
  templatesToStored,
} from "@/lib/storage";
import {
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
  const [activeTemplateRole, setActiveTemplateRole] =
    useState<Role>("fullstack");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = loadState();
    setConfig(saved.config);
    setRecipients(saved.recipients);
    setTemplates(templatesFromStored(saved.templates));
    setDelaySec(saved.delaySec);
    setActiveTemplateRole(saved.activeTemplateRole);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        const storedTemplates = await templatesToStored(templates);
        saveState({
          config,
          recipients,
          templates: storedTemplates,
          delaySec,
          activeTemplateRole,
        });
      })();
    }, 350);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    hydrated,
    config,
    recipients,
    templates,
    delaySec,
    activeTemplateRole,
  ]);

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
    setActiveTemplateRole(fresh.activeTemplateRole);
  }

  if (!hydrated) {
    return (
      <main className="page">
        <p className="status-line">Loading…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-text">
          <p className="brand">AutoMailSend</p>
          <p className="lede">
            Role templates stay saved · switch anytime
          </p>
        </div>
      </header>

      <div className="board">
        <SmtpConfigPanel
          config={config}
          onChange={setConfig}
          onResetAll={resetAll}
        />
        <RecipientManager recipients={recipients} onChange={setRecipients} />
        <RoleTemplates
          recipients={recipients}
          templates={templates}
          activeRole={activeTemplateRole}
          onActiveRoleChange={setActiveTemplateRole}
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
    </main>
  );
}
