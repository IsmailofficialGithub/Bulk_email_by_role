"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import dynamic from 'next/dynamic';

const Joyride: any = dynamic(() => import('react-joyride'), { ssr: false });

import { RecipientManager } from "@/components/RecipientManager";
import { RoleTemplates } from "@/components/RoleTemplates";
import { SendPanel } from "@/components/SendPanel";
import { QuickSendTab } from "@/components/QuickSendTab";
import { SmtpConfigPanel } from "@/components/SmtpConfigPanel";
import { ExecutionLogsPanel } from "@/components/ExecutionLogsPanel";
import { EmailsTab } from "@/components/EmailsTab";
import { AutoFetchModal } from "@/components/AutoFetchModal";
import { AutomailModal } from "@/components/AutomailModal";
import { LandingPage } from "@/components/LandingPage";
import { AdminPortal } from "@/components/AdminPortal";
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
  
  const [activeTab, setActiveTab] = useState<"contacts" | "templates" | "sending" | "quicksend" | "settings" | "logs" | "emails" | "admin">("contacts");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentTab = window.location.pathname.replace('/', '') || 'contacts';
      if (["contacts", "templates", "sending", "quicksend", "settings", "logs", "emails", "admin"].includes(currentTab)) {
        setActiveTab(currentTab as any);
      }

      const handlePopState = () => {
        const popTab = window.location.pathname.replace('/', '') || 'contacts';
        if (["contacts", "templates", "sending", "quicksend", "settings", "logs", "emails", "admin"].includes(popTab)) {
          setActiveTab(popTab as any);
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const handleTabChange = (tab: "contacts" | "templates" | "sending" | "quicksend" | "settings" | "logs" | "emails" | "admin") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.pushState(null, '', `/${tab}`);
    }
  };
  
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
  
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  
  const [showPasswordChange, setShowPasswordChange] = useState(false);
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

  const sentTodayCount = sentLog.filter(s => s.status === 'sent' && new Date(s.sentAt).toDateString() === new Date().toDateString()).length;

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
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",");
        setIsAdmin(adminEmails.includes(session.user.email || ""));
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
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",");
        setIsAdmin(adminEmails.includes(session.user.email || ""));
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
      setSending(saved.batchSendPending);
      
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
            return [rowData, ...prev];
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automailsend_sent_log',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newLog = payload.new;
          setSentLog((prev) => {
            // Avoid duplicates
            if (prev.some(s => s.email === newLog.email && s.role === newLog.role && s.sentAt === newLog.sent_at)) {
              return prev;
            }
            return [{
              email: newLog.email,
              role: newLog.role as Role,
              title: newLog.title || "",
              status: newLog.status || "sent",
              error: newLog.error_message || undefined,
              sentAt: newLog.sent_at,
            }, ...prev];
          });
          // Also toast success/fail if it was from background job
          if (newLog.status === 'sent') {
            toast.success(`Sent email to ${newLog.email}`);
          } else if (newLog.status === 'failed') {
            toast.error(`Failed sending to ${newLog.email}`);
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
    const currState = { config, delaySec, activeTemplateRole, defaultTitle, autoFetch, automail, batchSendPending: sending };
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
        batchSendPending: sending,
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

  const startTutorial = () => {
    setStepIndex(0);
    setRunTour(true);
    handleTabChange("templates");
  };

  const handleJoyrideCallback = (data: any) => {
    const { action, index, status, type } = data;
    
    if (status === 'finished' || status === 'skipped') {
      setRunTour(false);
      setShowSmtpModal(false);
      setShowAutoFetch(false);
      setShowAutomailModal(false);
      return;
    }

    if (type === 'step:after') {
      if (action === 'next') {
        const nextIndex = index + 1;
        
        if (nextIndex === 3) {
          handleTabChange("settings");
          setShowSmtpModal(true);
          setTimeout(() => setStepIndex(nextIndex), 100);
        } else if (nextIndex === 5) {
          setShowSmtpModal(false);
          setShowAutoFetch(true);
          setTimeout(() => setStepIndex(nextIndex), 100);
        } else if (nextIndex === 7) {
          setShowAutoFetch(false);
          setShowAutomailModal(true);
          setTimeout(() => setStepIndex(nextIndex), 100);
        } else {
          setStepIndex(nextIndex);
        }
      } else if (action === 'prev') {
        const prevIndex = index - 1;
        
        if (prevIndex === 2) {
          setShowSmtpModal(false);
          handleTabChange("templates");
          setTimeout(() => setStepIndex(prevIndex), 100);
        } else if (prevIndex === 4) {
          setShowAutoFetch(false);
          setShowSmtpModal(true);
          setTimeout(() => setStepIndex(prevIndex), 100);
        } else if (prevIndex === 6) {
          setShowAutomailModal(false);
          setShowAutoFetch(true);
          setTimeout(() => setStepIndex(prevIndex), 100);
        } else {
          setStepIndex(prevIndex);
        }
      }
    }
  };

  const steps = [
    {
      target: 'body',
      content: 'Welcome to Viddr! Let\'s get you set up to automate your emails. This will take just 2 minutes.',
      placement: 'center' as const,
    },
    {
      target: '#tour-templates-subject',
      content: 'First, write an attention-grabbing subject line for your template.',
      disableBeacon: true,
    },
    {
      target: '#tour-templates-body',
      content: 'Then, write the main body of your email. You can use placeholders like {name} which will be automatically replaced later.',
    },
    {
      target: '#tour-smtp-email',
      content: 'Next, enter the email address you want to send emails from (e.g. your Gmail).',
    },
    {
      target: '#tour-smtp-password',
      content: 'Enter your App Password here. If you use Gmail, you need to generate a 16-character App Password from your Google Account settings.',
    },
    {
      target: '#tour-autofetch-keywords',
      content: 'Want to automatically scrape leads? Enter keywords like "software engineer" here, and we will find leads on LinkedIn.',
    },
    {
      target: '#tour-autofetch-interval',
      content: 'Set how often the scraper should run in the background.',
    },
    {
      target: '#tour-automail-enable',
      content: 'Enable Automail to let our AI automatically personalize and send emails to the leads you scrape.',
    },
    {
      target: '#tour-automail-rules',
      content: 'Set a daily limit to avoid spam filters (we recommend 50/day). You\'re all set after this!',
    }
  ];

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: 'var(--bg)', position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', opacity: 0, animation: 'fadeIn 0.5s ease-out forwards' }}>
          <div style={{ position: 'relative' }}>
            <img src="/logo.png" alt="Viddr Logo" style={{ width: '4.5rem', height: '4.5rem', borderRadius: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.1)' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '14px', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display), Georgia, serif' }}>Viddr</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>Preparing your workspace...</p>
          </div>
          <div style={{ width: '12rem', height: '4px', background: 'var(--line)', borderRadius: '999px', overflow: 'hidden', marginTop: '0.5rem' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '999px', animation: 'indeterminate-progress 1.5s ease-in-out infinite' }} />
          </div>
        </div>
        <style>{`
          @keyframes indeterminate-progress {
            0% { transform: translateX(-100%); width: 40%; }
            50% { transform: translateX(30%); width: 80%; }
            100% { transform: translateX(250%); width: 40%; }
          }
        `}</style>
      </div>
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
            className="sidebar-tab"
            style={{ 
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)', 
              color: 'var(--accent)', 
              fontWeight: 650, 
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: '1rem',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 10%, transparent)'
            }}
            onClick={startTutorial}
          >
            Start Tutorial ✨
          </button>
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
            className={`sidebar-tab ${activeTab === 'quicksend' ? 'active' : ''}`}
            onClick={() => handleTabChange('quicksend')}
          >
            Quick Send (AI)
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => handleTabChange('logs')}
          >
            Logs
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'emails' ? 'active' : ''}`}
            onClick={() => handleTabChange('emails')}
          >
            Emails CRM
          </button>
          <button 
            className={`sidebar-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            Settings
          </button>
          {isAdmin && (
            <button 
              className={`sidebar-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => handleTabChange('admin')}
              style={{ 
                color: "var(--err)", 
                fontWeight: 650,
                marginTop: '1rem',
                border: "1px solid color-mix(in srgb, var(--err) 30%, transparent)", 
                background: activeTab === 'admin' ? "color-mix(in srgb, var(--err) 15%, transparent)" : "color-mix(in srgb, var(--err) 5%, transparent)" 
              }}
            >
              Admin Portal 🛡️
            </button>
          )}
        </nav>
        
        <div style={{ marginTop: 'auto' }}>
          <button onClick={handleLogout} className="btn ghost danger" style={{ width: '100%', justifyContent: 'center' }}>
            Log Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header style={{ 
          padding: '1rem 2rem', 
          background: 'var(--bg-elevated)', 
          borderBottom: '1px solid var(--line)', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--muted)' }}>Daily Mail Limit:</span>
            <div style={{ 
              background: 'var(--bg)', 
              padding: '4px 12px', 
              borderRadius: '999px', 
              border: '1px solid var(--line)', 
              fontWeight: 600, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: sentTodayCount >= automail.dailyLimit ? '#ef4444' : '#10b981' 
              }}></div>
              {sentTodayCount} / {automail.dailyLimit}
            </div>
          </div>
        </header>

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

          {activeTab === 'emails' && (
            <EmailsTab 
              recipients={recipients}
              onUpdateStatus={async (id, field, newStatus) => {
                const updated = recipients.map(r => r.id === id ? { ...r, [field]: newStatus } : r);
                setRecipients(updated);
                await supabase.from("automailsend_recipients").update({ [field]: newStatus }).eq("id", id);
              }}
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
                sentTodayCount={sentTodayCount}
              />
            </>
          )}

          {activeTab === 'quicksend' && (
            <QuickSendTab 
              userId={userId}
              config={config}
              automail={automail}
              onSendingChange={setSending}
              sentTodayCount={sentTodayCount}
            />
          )}

          {activeTab === 'logs' && (
            <div className="panel flex-col gap-4">
              <ExecutionLogsPanel userId={userId} />
            </div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <div className="panel flex-col gap-4">
              <AdminPortal />
            </div>
          )}

          {activeTab === 'admin' && !isAdmin && (
            <div className="panel flex-col gap-4" style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
              <h2 className="panel-title" style={{ color: "var(--err)" }}>Access Denied</h2>
              <p className="hint">You do not have administrative privileges to view this portal.</p>
              <button className="btn primary" onClick={() => handleTabChange('contacts')} style={{ margin: "1rem auto 0" }}>
                Return to Dashboard
              </button>
            </div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="smtp-bar-left">
                    <span className="smtp-bar-title">Login Password</span>
                  </div>
                  <div className="smtp-bar-actions">
                    <button type="button" className="btn primary" onClick={() => setShowPasswordChange(!showPasswordChange)}>
                      {showPasswordChange ? "Collapse" : "Expand"}
                    </button>
                  </div>
                </div>
                {showPasswordChange && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
                    <p className="hint compact" style={{ marginBottom: '0.75rem' }}>Update the password you use to log into Viddr.</p>
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
                )}
              </div>
            </div>
          )}

          {showAutoFetch && (
            <AutoFetchModal
              config={autoFetch}
              onSave={setAutoFetch}
              onClose={() => {
                setShowAutoFetch(false);
                if (runTour) setRunTour(false);
              }}
            />
          )}

          {showAutomailModal && (
            <AutomailModal
              config={automail}
              smtpConfig={config}
              templates={templates}
              sentTodayCount={sentTodayCount}
              onSave={setAutomail}
              onClose={() => {
                setShowAutomailModal(false);
                if (runTour) setRunTour(false);
              }}
            />
          )}

          {showSmtpModal && (
            <SmtpConfigPanel
              config={config}
              onChange={setConfig}
              onResetAll={resetAll}
              onClose={() => {
                setShowSmtpModal(false);
                if (runTour) setRunTour(false);
              }}
            />
          )}
        </div>
      </main>

      <Joyride
        steps={steps}
        run={runTour}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        styles={{
          options: {
            primaryColor: 'var(--accent)',
            zIndex: 1000000,
          }
        }}
      />
    </div>
  );
}
