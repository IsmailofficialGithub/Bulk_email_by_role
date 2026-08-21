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
  phone_status?: "pending" | "sent" | "wrong_number";
  source?: "auto_fetch" | "manual";
  source_url?: string;
  scraped_at?: string;
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
  email: string; // The username for SMTP authentication
  appPassword: string;
  fromEmail?: string; // The sender email address
  fromName?: string;
  provider?: string;
  host?: string;
  port?: number;
  configured: boolean;
  batchMode?: "ai" | "template";
  batchTargetIds?: string[];
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
  subject?: string;
  body?: string;
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
  /** Seconds to wait between each automail send */
  perMailDelaySec: number;
  aiProvider: string;
  aiApiKey: string;
  aiPrompt: string;
};

export type CommentRecord = {
  id: string;
  postUrl: string;
  commentText: string;
  status: "sent" | "failed";
  error?: string;
  sentAt: string;
};

export type AutoCommentConfig = {
  enabled: boolean;
  aiPrompt: string;
  dailyLimit: number;
  intervalMin: number;
  keywords?: string; // Optional niche keywords for searching posts (comma separated)
};
