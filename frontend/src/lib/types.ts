export const ROLES = [
  "devops",
  "fullstack",
  "ai-automation",
  "custom",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  devops: "DevOps",
  fullstack: "Fullstack",
  "ai-automation": "AI Automation",
  custom: "Custom",
};

export type Recipient = {
  id: string;
  email: string;
  role: Role;
  title: string;
  phone?: string;
  status?: "pending" | "sent" | "failed";
  source?: "auto_fetch" | "manual";
};

export type Attachment = {
  id: string;
  name: string;
  type: string;
  url: string;
  storagePath: string;
  size?: number;
};

export type RoleTemplate = {
  subject: string;
  content: string;
  files: Attachment[];
};

export type SmtpConfig = {
  email: string;
  appPassword: string;
  fromName?: string;
  provider?: string;
  host?: string;
  port?: number;
  configured: boolean;
};

export type SendResult = {
  email: string;
  role: Role;
  success: boolean;
  error?: string;
  skipped?: boolean;
};

export type SentRecord = {
  email: string;
  role: Role;
  title: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
  sentAt: string;
};

export type AutoFetchConfig = {
  enabled: boolean;
  keywords: string;
  targetRole: Role;
  intervalMin: number;
  paginationLimit: number;
  paginationDelaySec: number;
  liAt: string;
  jsessionid: string;
  rawHeaders: string;
  postAgeFilter: "any" | "past-24h" | "past-week" | "past-month";
};

export type AutomailConfig = {
  enabled: boolean;
  dailyLimit: number;
  aiProvider: "none" | "groq" | "openai" | "gemini";
  aiApiKey: string;
  aiPrompt: string;
};
