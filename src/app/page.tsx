"use client";

import { useState } from "react";
import { RecipientManager } from "@/components/RecipientManager";
import { RoleTemplates } from "@/components/RoleTemplates";
import { SendPanel } from "@/components/SendPanel";
import { SmtpConfigPanel } from "@/components/SmtpConfigPanel";
import {
  ROLES,
  type Recipient,
  type Role,
  type RoleTemplate,
  type SmtpConfig,
} from "@/lib/types";

function emptyTemplates(): Record<Role, RoleTemplate> {
  return {
    devops: { subject: "", content: "", files: [] },
    fullstack: { subject: "", content: "", files: [] },
    "ai-automation": { subject: "", content: "", files: [] },
    custom: { subject: "", content: "", files: [] },
  };
}

export default function Home() {
  const [config, setConfig] = useState<SmtpConfig>({
    email: "",
    appPassword: "",
    configured: false,
  });
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] =
    useState<Record<Role, RoleTemplate>>(emptyTemplates);

  function updateTemplate(role: Role, patch: Partial<RoleTemplate>) {
    setTemplates((prev) => ({
      ...prev,
      [role]: { ...prev[role], ...patch },
    }));
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="brand">AutoMailSend</p>
        <h1>Bulk email by role</h1>
        <p className="lede">
          Configure SMTP, add recipients with roles, set per-role content and
          attachments, then send with delay.
        </p>
      </header>

      <div className="stack">
        <SmtpConfigPanel config={config} onChange={setConfig} />
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
        />
      </div>

      <footer className="foot">
        Roles: {ROLES.join(" · ")} · Powered by Nodemailer + Next.js API
      </footer>
    </main>
  );
}
