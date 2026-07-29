import {
  ROLES,
  type Recipient,
  type Role,
  type RoleTemplate,
  type SmtpConfig,
} from "@/lib/types";

export const STORAGE_KEY = "automailsend:v1";

export type StoredTemplate = {
  subject: string;
  content: string;
};

export type PersistedState = {
  config: SmtpConfig;
  recipients: Recipient[];
  templates: Record<Role, StoredTemplate>;
  delaySec: number;
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
    templates: {
      devops: { subject: "", content: "" },
      fullstack: { subject: "", content: "" },
      "ai-automation": { subject: "", content: "" },
      custom: { subject: "", content: "" },
    },
    delaySec: 3,
  };
}

export function loadState(): PersistedState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const base = defaultState();
    return {
      config: {
        email: parsed.config?.email ?? "",
        appPassword: parsed.config?.appPassword ?? "",
        configured: Boolean(parsed.config?.configured),
      },
      recipients: Array.isArray(parsed.recipients)
        ? parsed.recipients.map((r) => ({
            id: r.id || `${Date.now()}-${Math.random()}`,
            email: r.email,
            role: ROLES.includes(r.role) ? r.role : "custom",
            title: r.title ?? "",
          }))
        : [],
      templates: ROLES.reduce(
        (acc, role) => {
          acc[role] = {
            subject: parsed.templates?.[role]?.subject ?? "",
            content: parsed.templates?.[role]?.content ?? "",
          };
          return acc;
        },
        {} as Record<Role, StoredTemplate>
      ),
      delaySec:
        typeof parsed.delaySec === "number" && parsed.delaySec >= 0
          ? parsed.delaySec
          : base.delaySec,
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function templatesFromStored(
  stored: Record<Role, StoredTemplate>
): Record<Role, RoleTemplate> {
  const next = emptyTemplates();
  for (const role of ROLES) {
    next[role] = {
      subject: stored[role]?.subject ?? "",
      content: stored[role]?.content ?? "",
      files: [],
    };
  }
  return next;
}
