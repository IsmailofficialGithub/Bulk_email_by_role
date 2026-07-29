import { supabase } from "./supabase";
import {
  ROLES,
  type Recipient,
  type Role,
  type RoleTemplate,
  type SentRecord,
  type SmtpConfig,
  type Attachment,
} from "@/lib/types";

export type PersistedState = {
  config: SmtpConfig;
  recipients: Recipient[];
  templates: Record<Role, RoleTemplate>;
  delaySec: number;
  activeTemplateRole: Role;
  defaultTitle: string;
  sentLog: SentRecord[];
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
    config: { email: "", appPassword: "", configured: false },
    recipients: [],
    templates: emptyTemplates(),
    delaySec: 3,
    activeTemplateRole: "fullstack",
    defaultTitle: "",
    sentLog: [],
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
    .from("attachments")
    .upload(filePath, file);

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);

  return {
    id: filePath,
    name: file.name,
    type: file.type || "application/octet-stream",
    url: data.publicUrl,
    storagePath: filePath,
    size: file.size,
  };
}

export async function deleteAttachment(storagePath: string) {
  await supabase.storage.from("attachments").remove([storagePath]);
}

export async function loadState(userId: string): Promise<PersistedState> {
  const state = defaultState();

  // Load app_state
  const { data: appState } = await supabase
    .from("automailsend_app_state")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (appState) {
    state.config = appState.config;
    state.delaySec = appState.delay_sec;
    state.activeTemplateRole = appState.active_template_role as Role;
    state.defaultTitle = appState.default_title;
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
      config: state.config,
      delay_sec: state.delaySec,
      active_template_role: state.activeTemplateRole,
      default_title: state.defaultTitle,
    },
    { onConflict: "user_id" }
  );
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
  // Simple sync: delete all and insert. For production, you might want to diff.
  await supabase.from("automailsend_recipients").delete().eq("user_id", userId);
  if (recipients.length > 0) {
    await supabase.from("automailsend_recipients").insert(
      recipients.map((r) => ({
        id: r.id,
        user_id: userId,
        email: r.email,
        role: r.role,
        title: r.title,
      }))
    );
  }
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
    sent_at: record.sentAt,
  });
}
