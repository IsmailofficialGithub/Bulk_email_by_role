import {
  ROLES,
  type Recipient,
  type Role,
  type RoleTemplate,
  type SentRecord,
  type SmtpConfig,
} from "@/lib/types";

export const STORAGE_KEY = "automailsend:v2";

export type StoredFile = {
  name: string;
  type: string;
  data: string;
};

export type StoredTemplate = {
  subject: string;
  content: string;
  files: StoredFile[];
};

export type PersistedState = {
  config: SmtpConfig;
  recipients: Recipient[];
  templates: Record<Role, StoredTemplate>;
  delaySec: number;
  activeTemplateRole: Role;
  defaultTitle: string;
  sentLog: SentRecord[];
};

function emptyStoredTemplates(): Record<Role, StoredTemplate> {
  return {
    devops: { subject: "", content: "", files: [] },
    fullstack: { subject: "", content: "", files: [] },
    "ai-automation": { subject: "", content: "", files: [] },
    custom: { subject: "", content: "", files: [] },
  };
}

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
    templates: emptyStoredTemplates(),
    delaySec: 3,
    activeTemplateRole: "fullstack",
    defaultTitle: "",
    sentLog: [],
  };
}

function fileFromStored(stored: StoredFile): File {
  const binary = atob(stored.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], stored.name, {
    type: stored.type || "application/octet-stream",
  });
}

export async function fileToStored(file: File): Promise<StoredFile> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    data: btoa(binary),
  };
}

export function templatesFromStored(
  stored: Record<Role, StoredTemplate>
): Record<Role, RoleTemplate> {
  const next = emptyTemplates();
  for (const role of ROLES) {
    const item = stored[role];
    next[role] = {
      subject: item?.subject ?? "",
      content: item?.content ?? "",
      files: Array.isArray(item?.files)
        ? item.files.map((f) => fileFromStored(f))
        : [],
    };
  }
  return next;
}

export async function templatesToStored(
  templates: Record<Role, RoleTemplate>
): Promise<Record<Role, StoredTemplate>> {
  const out = emptyStoredTemplates();
  for (const role of ROLES) {
    const tpl = templates[role];
    out[role] = {
      subject: tpl.subject,
      content: tpl.content,
      files: await Promise.all(tpl.files.map((f) => fileToStored(f))),
    };
  }
  return out;
}

function migrateLegacy(): PersistedState | null {
  const legacy = localStorage.getItem("automailsend:v1");
  if (!legacy) return null;
  try {
    const parsed = JSON.parse(legacy) as Partial<PersistedState>;
    const base = defaultState();
    return {
      ...base,
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
            files: [],
          };
          return acc;
        },
        emptyStoredTemplates()
      ),
      delaySec:
        typeof parsed.delaySec === "number" && parsed.delaySec >= 0
          ? parsed.delaySec
          : base.delaySec,
      defaultTitle: "",
      sentLog: [],
    };
  } catch {
    return null;
  }
}

export function loadState(): PersistedState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const migrated = migrateLegacy();
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem("automailsend:v1");
        return migrated;
      }
      return defaultState();
    }
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const base = defaultState();
    const activeTemplateRole = ROLES.includes(
      parsed.activeTemplateRole as Role
    )
      ? (parsed.activeTemplateRole as Role)
      : base.activeTemplateRole;

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
            files: Array.isArray(parsed.templates?.[role]?.files)
              ? parsed.templates![role].files
              : [],
          };
          return acc;
        },
        emptyStoredTemplates()
      ),
      delaySec:
        typeof parsed.delaySec === "number" && parsed.delaySec >= 0
          ? parsed.delaySec
          : base.delaySec,
      activeTemplateRole,
      defaultTitle:
        typeof parsed.defaultTitle === "string" ? parsed.defaultTitle : "",
      sentLog: Array.isArray(parsed.sentLog)
        ? parsed.sentLog
            .filter(
              (s): s is SentRecord =>
                !!s &&
                typeof s.email === "string" &&
                typeof s.role === "string"
            )
            .map((s) => ({
              email: s.email.toLowerCase(),
              role: ROLES.includes(s.role) ? s.role : "custom",
              title: s.title ?? "",
              sentAt: s.sentAt || new Date().toISOString(),
            }))
        : [],
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    const withoutHeavyFiles: PersistedState = {
      ...state,
      templates: ROLES.reduce(
        (acc, role) => {
          acc[role] = {
            subject: state.templates[role].subject,
            content: state.templates[role].content,
            files: [],
          };
          return acc;
        },
        emptyStoredTemplates()
      ),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutHeavyFiles));
    } catch {
      // ignore quota errors
    }
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("automailsend:v1");
}
