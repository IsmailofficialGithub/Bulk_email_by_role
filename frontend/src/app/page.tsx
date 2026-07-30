"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RecipientManager } from "@/components/RecipientManager";
import { RoleTemplates } from "@/components/RoleTemplates";
import { SendPanel } from "@/components/SendPanel";
import { SmtpConfigPanel } from "@/components/SmtpConfigPanel";
import { ExecutionLogsPanel } from "@/components/ExecutionLogsPanel";
import { supabase } from "@/lib/supabase";
import {
  defaultState,
  loadState,
  saveAppState,
  saveTemplates,
  syncRecipients,
  deleteAttachment,
} from "@/lib/storage";
import {
  type Recipient,
  type Role,
  type RoleTemplate,
  type SentRecord,
  type SmtpConfig,
  type AutoFetchConfig,
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
  const [autoFetch, setAutoFetch] = useState<AutoFetchConfig>(defaultState().autoFetch);
  
  // Track previous state for targeted saving
  const lastState = useRef({
    config: defaultState().config,
    delaySec: 3,
    activeTemplateRole: "fullstack" as Role,
    defaultTitle: "",
    autoFetch: defaultState().autoFetch,
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
      setAutoFetch(saved.autoFetch);
      
      lastState.current = {
        config: saved.config,
        delaySec: saved.delaySec,
        activeTemplateRole: saved.activeTemplateRole,
        defaultTitle: saved.defaultTitle,
        autoFetch: saved.autoFetch,
      };
      
      setHydrated(true);
    });
  }, [userId]);

  // Realtime updates from background worker
  useEffect(() => {
    if (!userId || !hydrated) return;

    const channel = supabase.channel('table-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'automailsend_recipients',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
             setRecipients(prev => prev.filter(r => r.id !== payload.old.id));
             return;
          }
          const newRow = payload.new;
          setRecipients((prev) => {
            const exists = prev.some(r => r.id === newRow.id);
            const rowData = {
              id: newRow.id,
              email: newRow.email,
              role: newRow.role as Role,
              title: newRow.title,
              phone: newRow.phone,
              status: newRow.status || 'pending',
              source: newRow.source || 'auto_fetch'
            };
            if (exists) {
              return prev.map(r => r.id === newRow.id ? rowData : r);
            }
            return [...prev, rowData];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automailsend_execution_logs',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const log = payload.new;
          if (log.details && (log.details.new_emails?.length > 0 || log.details.new_phones?.length > 0)) {
            const eCount = log.details.new_emails?.length || 0;
            const pCount = log.details.new_phones?.length || 0;
            toast.success(`Auto-Fetch found ${eCount} emails & ${pCount} phones!`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, hydrated]);

  // Debounced auto-save for app_state
  useEffect(() => {
    if (!hydrated || !userId) return;
    
    // Only save if app_state parts changed
    const currState = { config, delaySec, activeTemplateRole, defaultTitle, autoFetch };
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
        autoFetch,
      }).then(() => {
         lastState.current = currState;
      }).catch(console.error);
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, userId, config, delaySec, activeTemplateRole, defaultTitle, autoFetch, recipients, templates, sentLog]);

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
    // Delete all attachments from buckets before resetting
    Object.values(templates).forEach(tpl => {
      tpl.files.forEach(f => {
        deleteAttachment(f.storagePath).catch(console.error);
      });
    });

    // Only resetting local state for demo purposes, you might want a DB wipe
    const fresh = defaultState();
    setConfig(fresh.config);
    setRecipients([]);
    setTemplates(fresh.templates);
    setDelaySec(fresh.delaySec);
    setActiveTemplateRole(fresh.activeTemplateRole);
    setDefaultTitle(fresh.defaultTitle);
    setSentLog(fresh.sentLog);
    setAutoFetch(fresh.autoFetch);
    
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
      <header className="hero">
        <div className="hero-text">
          <p className="brand">AutoMailSend</p>
          <p className="lede">
            Role templates stay saved · switch anytime
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SmtpConfigPanel
            config={config}
            onChange={setConfig}
            onResetAll={resetAll}
          />
          <button onClick={handleLogout} className="btn ghost danger">Log Out</button>
        </div>
      </header>

      <div className="board board-three">
        <RecipientManager
          recipients={recipients}
          onChange={updateRecipients}
          defaultTitle={defaultTitle}
          onDefaultTitleChange={setDefaultTitle}
          autoFetch={autoFetch}
          onAutoFetchChange={setAutoFetch}
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

      <div className="mt-8">
        <ExecutionLogsPanel userId={userId} />
      </div>
    </main>
  );
}
