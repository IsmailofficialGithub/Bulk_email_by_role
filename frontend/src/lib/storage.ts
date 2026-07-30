import { supabase } from "./supabase";
import {
  type Recipient,
  type Role,
  type RoleTemplate,
  type SentRecord,
  type SmtpConfig,
  type Attachment,
  type AutoFetchConfig,
  type AutomailConfig,
} from "@/lib/types";

export type PersistedState = {
  config: SmtpConfig;
  recipients: Recipient[];
  templates: Record<Role, RoleTemplate>;
  delaySec: number;
  activeTemplateRole: Role;
  defaultTitle: string;
  sentLog: SentRecord[];
  autoFetch: AutoFetchConfig;
  automail: AutomailConfig;
};

export function emptyTemplates(): Record<Role, RoleTemplate> {
  return {
    devops: { subject: "", content: "", files: [] },
    fullstack: { subject: "", content: "", files: [] },
    "ai-automation": { subject: "", content: "", files: [] },
    custom: { subject: "", content: "", files: [] },
  };
}

export function defaultState(): PersistedState {
  return {
    config: { email: "", appPassword: "", fromName: "", configured: false },
    recipients: [],
    templates: emptyTemplates(),
    delaySec: 3,
    activeTemplateRole: "fullstack",
    defaultTitle: "",
    sentLog: [],
    autoFetch: {
      enabled: false,
      keywords: "",
      targetRole: "fullstack",
      intervalMin: 5,
      paginationLimit: 5,
      paginationDelaySec: 10,
      liAt: "",
      jsessionid: "",
      rawHeaders: "{}",
      postAgeFilter: "any",
    },
    automail: {
      enabled: false,
      dailyLimit: 50,
      aiProvider: "none",
      aiApiKey: "",
      aiPrompt: "You are an expert recruiter. Analyze the following LinkedIn post text. The author's email is {{email}}. Write a highly personalized, friendly, and concise email subject and body offering our services. Output ONLY valid JSON with 'subject' and 'body' keys.",
    },
  };
}

export async function uploadAttachment(
  file: File,
  userId: string
): Promise<Attachment> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from("automailsend_attachments")
    .upload(filePath, file);

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("automailsend_attachments").getPublicUrl(filePath);

  return {
    id: fileName,
    name: file.name,
    type: file.type,
    url: publicUrl,
    storagePath: filePath,
    size: file.size,
  };
}

export async function deleteAttachment(filePath: string) {
  const { error } = await supabase.storage
    .from("automailsend_attachments")
    .remove([filePath]);
  if (error) throw error;
}

export async function loadState(userId: string): Promise<PersistedState> {
  const state = defaultState();

  // Load app state
  const { data: appState } = await supabase
    .from("automailsend_app_state")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (appState) {
    state.config = {
      email: appState.smtp_email || "",
      appPassword: appState.smtp_password || "",
      fromName: (typeof window !== "undefined" ? localStorage.getItem("viddr_fromName") : "") || "",
      configured: !!appState.smtp_password,
    };
    state.delaySec = appState.send_delay_sec || 3;
    state.defaultTitle = appState.default_title || "";
    
    state.autoFetch = {
      enabled: appState.auto_fetch_enabled || false,
      keywords: appState.auto_fetch_keywords || "",
      targetRole: (appState.auto_fetch_template_role as any) || "fullstack",
      intervalMin: appState.auto_fetch_interval_min || 5,
      paginationLimit: appState.auto_fetch_pagination_limit || 5,
      paginationDelaySec: appState.auto_fetch_pagination_delay_sec || 10,
      liAt: appState.cookie_li_at || "",
      jsessionid: appState.cookie_jsessionid || "",
      rawHeaders: appState.auto_fetch_raw_headers || "{}",
      postAgeFilter: (appState.post_age_filter as any) || "any",
    };
    
    state.automail = {
      enabled: appState.automail_enabled || false,
      dailyLimit: appState.daily_mail_limit || 50,
      aiProvider: appState.ai_provider || "none",
      aiApiKey: appState.ai_api_key || "",
      aiPrompt: appState.ai_prompt || defaultState().automail.aiPrompt,
    };
  }

  // Load recipients
  const { data: recipients } = await supabase
    .from("automailsend_recipients")
    .select("*")
    .eq("user_id", userId);
  if (recipients) {
    state.recipients = recipients.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role as Role,
      title: r.title,
      phone: r.phone,
      status: r.status || "pending",
      source: r.source || "auto_fetch",
    }));
  }

  // Load templates
  const { data: templates } = await supabase
    .from("automailsend_templates")
    .select("*")
    .eq("user_id", userId);
  if (templates) {
    templates.forEach((t) => {
      state.templates[t.role as Role] = {
        subject: t.subject,
        content: t.content,
        files: t.files as Attachment[],
      };
    });
  }

  // Load sent log
  const { data: sentLog } = await supabase
    .from("automailsend_sent_log")
    .select("*")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false });
  if (sentLog) {
    state.sentLog = sentLog.map((s) => ({
      email: s.email,
      role: s.role as Role,
      title: s.title,
      status: s.status || "sent",
      error: s.error_message || undefined,
      sentAt: s.sent_at,
    }));
  }

  return state;
}

export async function saveAppState(userId: string, state: PersistedState) {
  // Update app_state
  await supabase.from("automailsend_app_state").upsert(
    {
      user_id: userId,
      smtp_email: state.config.email,
      smtp_password: state.config.appPassword,
      send_delay_sec: state.delaySec,
      active_template_role: state.activeTemplateRole,
      default_title: state.defaultTitle,
      auto_fetch_enabled: state.autoFetch.enabled,
      auto_fetch_keywords: state.autoFetch.keywords,
      auto_fetch_template_role: state.autoFetch.targetRole,
      auto_fetch_interval_min: state.autoFetch.intervalMin,
      auto_fetch_pagination_limit: state.autoFetch.paginationLimit,
      auto_fetch_pagination_delay_sec: state.autoFetch.paginationDelaySec,
      cookie_li_at: state.autoFetch.liAt,
      cookie_jsessionid: state.autoFetch.jsessionid,
      auto_fetch_raw_headers: state.autoFetch.rawHeaders,
      post_age_filter: state.autoFetch.postAgeFilter,
      automail_enabled: state.automail.enabled,
      daily_mail_limit: state.automail.dailyLimit,
      ai_provider: state.automail.aiProvider,
      ai_api_key: state.automail.aiApiKey,
      ai_prompt: state.automail.aiPrompt,
    },
    { onConflict: "user_id" }
  );

  if (typeof window !== "undefined") {
    localStorage.setItem("viddr_fromName", state.config.fromName || "");
  }
}

export async function saveTemplates(
  userId: string,
  templates: Record<Role, RoleTemplate>
) {
  const upsertData = Object.entries(templates).map(([role, t]) => ({
    user_id: userId,
    role,
    subject: t.subject,
    content: t.content,
    files: t.files,
  }));
  await supabase.from("automailsend_templates").upsert(upsertData, { onConflict: "user_id, role" });
}

export async function syncRecipients(userId: string, recipients: Recipient[]) {
  if (recipients.length === 0) return;
  const { error } = await supabase.from("automailsend_recipients").upsert(
    recipients.map((r) => ({
      id: r.id,
      user_id: userId,
      email: r.email,
      role: r.role,
      title: r.title,
      phone: r.phone || null,
      status: r.status || 'pending',
      source: r.source || 'manual',
    })),
    { onConflict: 'id' }
  );
  if (error) {
    console.error("Failed to sync recipients:", error);
  }
}

export async function deleteRecipient(id: string) {
  const { error } = await supabase.from("automailsend_recipients").delete().eq("id", id);
  if (error) throw error;
}

export async function addSentLog(
  userId: string,
  record: SentRecord
) {
  await supabase.from("automailsend_sent_log").insert({
    user_id: userId,
    email: record.email,
    role: record.role,
    title: record.title,
    status: record.status,
    error_message: record.error || null,
    sent_at: record.sentAt,
  });

  // Also update the recipient's status so the UI reflects it immediately
  await supabase.from("automailsend_recipients")
    .update({ status: record.status })
    .eq("user_id", userId)
    .eq("email", record.email);
}
