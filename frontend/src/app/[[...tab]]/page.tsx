"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { RecipientManager } from "@/components/RecipientManager";
import { RoleTemplates } from "@/components/RoleTemplates";
import { SendPanel } from "@/components/SendPanel";
import { SmtpConfigPanel } from "@/components/SmtpConfigPanel";
import { ExecutionLogsPanel } from "@/components/ExecutionLogsPanel";
import { AutoFetchModal } from "@/components/AutoFetchModal";
import { AutomailModal } from "@/components/AutomailModal";
import { LandingPage } from "@/components/LandingPage";
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
  
  const [activeTab, setActiveTab] = useState<"contacts" | "templates" | "sending" | "settings">("contacts");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentTab = window.location.pathname.replace('/', '') || 'contacts';
      if (["contacts", "templates", "sending", "settings"].includes(currentTab)) {
        setActiveTab(currentTab as any);
      }

      const handlePopState = () => {
        const popTab = window.location.pathname.replace('/', '') || 'contacts';
        if (["contacts", "templates", "sending", "settings"].includes(popTab)) {
          setActiveTab(popTab as any);
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const handleTabChange = (tab: "contacts" | "templates" | "sending" | "settings") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.pushState(null, '', `/${tab}`);
    }
  };
  
  const [userId, setUserId] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(false);
  
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
  const [automail, setAutomail] = useState(defaultState().automail);
  
  const [showAutoFetch, setShowAutoFetch] = useState(false);
  const [showAutomailModal, setShowAutomailModal] = useState(false);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // Track previous state for targeted saving
  const lastState = useRef({
    config: defaultState().config,
    delaySec: 3,
    activeTemplateRole: "fullstack" as Role,
    defaultTitle: "",
    autoFetch: defaultState().autoFetch,
    automail: defaultState().automail,
  });
  
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
          setShowLanding(true);
          setHydrated(true);
        } else {
          router.push("/login");
        }
      } else {
        setUserId(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
          setShowLanding(true);
          setHydrated(true);
          setUserId(null);
        } else {
          router.push("/login");
        }
      } else {
        setShowLanding(false);
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
      setAutomail(saved.automail);
      
      lastState.current = {
        config: saved.config,
        delaySec: saved.delaySec,
        activeTemplateRole: saved.activeTemplateRole,
        defaultTitle: saved.defaultTitle,
        autoFetch: saved.autoFetch,
        automail: saved.automail,
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
    const currState = { config, delaySec, activeTemplateRole, defaultTitle, autoFetch, automail };
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
        automail,
      }).then(() => {
         lastState.current = currState;
      }).catch(console.error);
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, userId, config, delaySec, activeTemplateRole, defaultTitle, autoFetch, automail, recipients, templates, sentLog]);

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

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      toast.error(error.message || "Failed to update password");
    } else {
      toast.success("Login password updated successfully!");
      setNewPassword("");
    }
  }

  if (showLanding) {
    return <LandingPage />;
  }

  if (!hydrated || !userId) {
    return (
      <main className="page min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="status-line animate-pulse">Loading…</p>
      </main>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="Viddr Logo" className="w-6 h-6 rounded shadow-sm" />
          <span>Viddr</span>
        </div>
        <nav className="sidebar-nav">
          <button 
            className={`sidebar-tab ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => handleTabChange('contacts')}
          >
            Scraper & Contacts
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => handleTabChange('templates')}
          >
            Templates & AI
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'sending' ? 'active' : ''}`}
            onClick={() => handleTabChange('sending')}
          >
            Sending & Automail
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            Settings
          </button>
        </nav>
        
        <div style={{ marginTop: 'auto' }}>
          <button onClick={handleLogout} className="btn ghost danger" style={{ width: '100%', justifyContent: 'center' }}>
            Log Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="board">
          {activeTab === 'contacts' && (
            <RecipientManager
              recipients={recipients}
              onChange={updateRecipients}
              defaultTitle={defaultTitle}
              onDefaultTitleChange={setDefaultTitle}
              autoFetch={autoFetch}
              onAutoFetchChange={setAutoFetch}
            />
          )}

          {activeTab === 'templates' && (
            <RoleTemplates
              userId={userId}
              recipients={recipients}
              templates={templates}
              activeRole={activeTemplateRole}
              onActiveRoleChange={setActiveTemplateRole}
              onChange={updateTemplate}
            />
          )}

          {activeTab === 'sending' && (
            <>
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
                automail={automail}
                onAutomailChange={setAutomail}
              />
              <div className="mt-8">
                <ExecutionLogsPanel userId={userId} />
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <div className="panel flex-col gap-4">
              <h2 className="panel-title">Application Settings</h2>
              <div className="smtp-bar" style={{ marginTop: '0.5rem' }}>
                <div className="smtp-bar-left">
                  <span className="smtp-bar-title">Account & SMTP Settings</span>
                  <span className={config.configured ? "badge ok" : "badge warn"}>
                    {config.configured ? "Ready" : "Setup needed"}
                  </span>
                </div>
                <div className="smtp-bar-actions">
                  <button type="button" className="btn primary" onClick={() => setShowSmtpModal(true)}>
                    Expand
                  </button>
                </div>
              </div>
              <div className="smtp-bar" style={{ marginTop: '0.5rem' }}>
                <div className="smtp-bar-left">
                  <span className="smtp-bar-title">LinkedIn Scraper Settings</span>
                  <span className={autoFetch.enabled ? "badge ok" : "badge warn"}>
                    {autoFetch.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="smtp-bar-actions">
                  <button type="button" className="btn primary" onClick={() => setShowAutoFetch(true)}>
                    Expand
                  </button>
                </div>
              </div>

              <div className="smtp-bar" style={{ marginTop: '0.5rem' }}>
                <div className="smtp-bar-left">
                  <span className="smtp-bar-title">AI & Automail Settings</span>
                  <span className={automail.enabled ? "badge ok" : "badge warn"}>
                    {automail.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="smtp-bar-actions">
                  <button type="button" className="btn primary" onClick={() => setShowAutomailModal(true)}>
                    Expand
                  </button>
                </div>
              </div>

              <div className="smtp-bar" style={{ marginTop: '0.5rem', display: 'block' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <span className="smtp-bar-title" style={{ display: 'block', marginBottom: '0.5rem' }}>Change Login Password</span>
                  <p className="hint compact" style={{ margin: 0 }}>Update the password you use to log into Viddr.</p>
                </div>
                <form onSubmit={handlePasswordChange} className="grid-2" style={{ alignItems: "flex-end" }}>
                  <label className="field">
                    <span>New Password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      disabled={passwordLoading}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={passwordLoading || !newPassword}
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {showAutoFetch && (
            <AutoFetchModal
              config={autoFetch}
              onSave={setAutoFetch}
              onClose={() => setShowAutoFetch(false)}
            />
          )}

          {showAutomailModal && (
            <AutomailModal
              config={automail}
              smtpConfig={config}
              templates={templates}
              sentTodayCount={sentLog.filter(s => s.status === 'sent' && new Date(s.sentAt).toDateString() === new Date().toDateString()).length}
              onSave={setAutomail}
              onClose={() => setShowAutomailModal(false)}
            />
          )}

          {showSmtpModal && (
            <SmtpConfigPanel
              config={config}
              onChange={setConfig}
              onResetAll={resetAll}
              onClose={() => setShowSmtpModal(false)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
