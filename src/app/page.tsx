"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RecipientManager } from "@/components/RecipientManager";
import { RoleTemplates } from "@/components/RoleTemplates";
import { SendPanel } from "@/components/SendPanel";
import { SmtpConfigPanel } from "@/components/SmtpConfigPanel";
import { supabase } from "@/lib/supabase";
import {
  defaultState,
  loadState,
  saveAppState,
  saveTemplates,
  syncRecipients,
} from "@/lib/storage";
import {
  type Recipient,
  type Role,
  type RoleTemplate,
  type SentRecord,
  type SmtpConfig,
} from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<SmtpConfig>(defaultState().config);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<Record<Role, RoleTemplate>>(
    defaultState().templates
  );
  const [delaySec, setDelaySec] = useState(3);
  const [sending, setSending] = useState(false);
  const [activeTemplateRole, setActiveTemplateRole] =
    useState<Role>("fullstack");
  const [defaultTitle, setDefaultTitle] = useState("");
  const [sentLog, setSentLog] = useState<SentRecord[]>([]);
  
  // Track previous state for targeted saving
  const lastState = useRef({
    config: defaultState().config,
    delaySec: 3,
    activeTemplateRole: "fullstack" as Role,
    defaultTitle: "",
  });
  
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setUserId(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setUserId(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    loadState(userId).then((saved) => {
      setConfig(saved.config);
      setRecipients(saved.recipients);
      setTemplates(saved.templates);
      setDelaySec(saved.delaySec);
      setActiveTemplateRole(saved.activeTemplateRole);
      setDefaultTitle(saved.defaultTitle);
      setSentLog(saved.sentLog);
      
      lastState.current = {
        config: saved.config,
        delaySec: saved.delaySec,
        activeTemplateRole: saved.activeTemplateRole,
        defaultTitle: saved.defaultTitle,
      };
      
      setHydrated(true);
    });
  }, [userId]);

  // Debounced auto-save for app_state
  useEffect(() => {
    if (!hydrated || !userId) return;
    
    // Only save if app_state parts changed
    const currState = { config, delaySec, activeTemplateRole, defaultTitle };
    if (JSON.stringify(currState) === JSON.stringify(lastState.current)) {
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAppState(userId, {
        config,
        recipients, // not saved in app_state
        templates, // not saved in app_state
        delaySec,
        activeTemplateRole,
        defaultTitle,
        sentLog, // not saved in app_state
      }).then(() => {
         lastState.current = currState;
      }).catch(console.error);
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, userId, config, delaySec, activeTemplateRole, defaultTitle]);

  function updateTemplate(role: Role, patch: Partial<RoleTemplate>) {
    const newTemplates = {
      ...templates,
      [role]: { ...templates[role], ...patch },
    };
    setTemplates(newTemplates);
    if (userId) {
      saveTemplates(userId, newTemplates).catch(console.error);
    }
  }
  
  function updateRecipients(newRecipients: Recipient[]) {
    setRecipients(newRecipients);
    if (userId) {
      syncRecipients(userId, newRecipients).catch(console.error);
    }
  }

  function resetAll() {
    // Only resetting local state for demo purposes, you might want a DB wipe
    const fresh = defaultState();
    setConfig(fresh.config);
    setRecipients([]);
    setTemplates(fresh.templates);
    setDelaySec(fresh.delaySec);
    setActiveTemplateRole(fresh.activeTemplateRole);
    setDefaultTitle(fresh.defaultTitle);
    setSentLog(fresh.sentLog);
    
    if (userId) {
      saveAppState(userId, fresh).catch(console.error);
      saveTemplates(userId, fresh.templates).catch(console.error);
      syncRecipients(userId, []).catch(console.error);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (!hydrated || !userId) {
    return (
      <main className="page min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="status-line animate-pulse">Loading…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="absolute top-4 right-4">
        <button onClick={handleLogout} className="btn ghost">Log Out</button>
      </div>
      <header className="hero">
        <div className="hero-text">
          <p className="brand">AutoMailSend</p>
          <p className="lede">
            Role templates stay saved · switch anytime
          </p>
        </div>
        <SmtpConfigPanel
          config={config}
          onChange={setConfig}
          onResetAll={resetAll}
        />
      </header>

      <div className="board board-three">
        <RecipientManager
          recipients={recipients}
          onChange={updateRecipients}
          defaultTitle={defaultTitle}
          onDefaultTitleChange={setDefaultTitle}
        />
        <RoleTemplates
          userId={userId}
          recipients={recipients}
          templates={templates}
          activeRole={activeTemplateRole}
          onActiveRoleChange={setActiveTemplateRole}
          onChange={updateTemplate}
        />
        <SendPanel
          userId={userId}
          config={config}
          recipients={recipients}
          templates={templates}
          delaySec={delaySec}
          onDelayChange={setDelaySec}
          sending={sending}
          onSendingChange={setSending}
          sentLog={sentLog}
          onSentLogChange={setSentLog}
        />
      </div>
    </main>
  );
}
