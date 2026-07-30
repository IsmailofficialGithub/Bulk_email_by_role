"use client";

import { useMemo, useState } from "react";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";
import {
  ROLE_LABELS,
  ROLES,
  type Recipient,
  type Role,
  type RoleTemplate,
  type Attachment,
} from "@/lib/types";
import { uploadAttachment, deleteAttachment } from "@/lib/storage";
import toast from "react-hot-toast";

type Props = {
  userId: string;
  recipients: Recipient[];
  templates: Record<Role, RoleTemplate>;
  activeRole: Role;
  onActiveRoleChange: (role: Role) => void;
  onChange: (role: Role, patch: Partial<RoleTemplate>) => void;
};

export function RoleTemplates({
  userId,
  recipients,
  templates,
  activeRole,
  onActiveRoleChange,
  onChange,
}: Props) {
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const counts = useMemo(() => {
    const map: Record<Role, number> = {
      devops: 0,
      fullstack: 0,
      "ai-automation": 0,
      custom: 0,
    };
    recipients.forEach((r) => {
      map[r.role] += 1;
    });
    return map;
  }, [recipients]);

  const tpl = templates[activeRole];

  function removeFile(index: number, storagePath: string) {
    deleteAttachment(storagePath).catch(console.error);
    onChange(activeRole, {
      files: tpl.files.filter((_, i) => i !== index),
    });
    toast.success("Attachment deleted");
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>3. Templates</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <span className="badge">
            {(Object.values(templates).reduce((sum, t) => sum + t.files.reduce((fSum, f) => fSum + (f.size || 0), 0), 0) / (1024 * 1024)).toFixed(1)} MB / 40.0 MB
          </span>
          <span className="badge">saved per role</span>
        </div>
      </div>
      <div className="panel-body">
        <p className="hint compact">
          Settings stay saved when you switch roles · {"{{title}}"} {"{{email}}"}
        </p>

        <div className="role-tabs" role="tablist">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={activeRole === role}
              className={`role-tab${activeRole === role ? " active" : ""}${
                counts[role] > 0 ? " has-recipients" : ""
              }`}
              onClick={() => onActiveRoleChange(role)}
            >
              <span>{ROLE_LABELS[role]}</span>
              <span className="role-tab-count">{counts[role]}</span>
            </button>
          ))}
        </div>

        <div className="scroll-area template-editor">
          <div className="template-card single">
            <div className="template-head">
              <h3>{ROLE_LABELS[activeRole]}</h3>
              <span className="chip">
                {counts[activeRole]} recipient
                {counts[activeRole] === 1 ? "" : "s"}
              </span>
            </div>

            <label className="field">
              <span>Subject</span>
              <input
                type="text"
                value={tpl.subject}
                onChange={(e) =>
                  onChange(activeRole, { subject: e.target.value })
                }
                placeholder={`${ROLE_LABELS[activeRole]} subject`}
              />
            </label>

            <label className="field stretch">
              <span>Content</span>
              <AutoGrowTextarea
                className="textarea-content"
                value={tpl.content}
                maxHeight={320}
                onChange={(e) =>
                  onChange(activeRole, { content: e.target.value })
                }
                placeholder="Email body for this role…"
              />
            </label>

            <div className="attach-block">
              <div className="attach-head">
                <span className="attach-label">
                  Attachments ({tpl.files.length})
                </span>
                <label className="btn attach-add">
                  {isUploading ? "Uploading..." : tpl.files.length === 0 ? "Add attachment" : "Add more"}
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    disabled={isUploading}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;

                      const MAX_FILE_SIZE = 11 * 1024 * 1024; // 11 MB
                      const MAX_TOTAL_SIZE = 40 * 1024 * 1024; // 40 MB
                      
                      let currentTotalSize = Object.values(templates).reduce((sum, t) => {
                        return sum + t.files.reduce((fSum, f) => fSum + (f.size || 0), 0);
                      }, 0);

                      const validFiles = [];
                      for (const file of files) {
                        if (file.size > MAX_FILE_SIZE) {
                          toast.error(`File ${file.name} is too large. Maximum size per file is 11 MB.`);
                          continue;
                        }
                        if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
                          toast.error(`Cannot upload ${file.name}. Total upload limit of 40 MB exceeded.`);
                          continue;
                        }
                        validFiles.push(file);
                        currentTotalSize += file.size;
                      }

                      if (!validFiles.length) {
                         e.target.value = "";
                         return;
                      }

                      try {
                        setIsUploading(true);
                        setUploadProgress(0);
                        const progressInterval = setInterval(() => {
                          setUploadProgress(prev => {
                            if (prev >= 90) return 90;
                            return prev + (90 - prev) * 0.15 + Math.random() * 5;
                          });
                        }, 200);

                        const attachments = await Promise.all(
                          validFiles.map((f) => uploadAttachment(f, userId))
                        );

                        clearInterval(progressInterval);
                        setUploadProgress(100);

                        setTimeout(() => {
                          onChange(activeRole, {
                            files: [...tpl.files, ...attachments],
                          });
                          toast.success("Attachment(s) uploaded successfully");
                          setIsUploading(false);
                          setUploadProgress(0);
                        }, 400);
                      } catch (err) {
                        console.error("Upload failed", err);
                        toast.error("Failed to upload attachment");
                        setIsUploading(false);
                        setUploadProgress(0);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {isUploading && uploadProgress > 0 && (
                <div style={{ padding: "0.5rem 0" }}>
                  <div className="progress" style={{ height: "6px", background: "var(--bg-elevated)", borderRadius: "999px", overflow: "hidden" }}>
                    <div 
                      className="progress-bar" 
                      style={{ 
                        width: `${uploadProgress}%`, 
                        height: "100%", 
                        background: "var(--accent)", 
                        transition: "width 0.2s ease-out" 
                      }} 
                    />
                  </div>
                  <p className="hint text-right" style={{ marginTop: "0.25rem", marginBottom: 0 }}>
                    Uploading... {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}

              {tpl.files.length > 0 ? (
                <ul className="file-list tall">
                  {tpl.files.map((f, index) => (
                    <li key={f.id} title={f.name}>
                      <button
                        type="button"
                        className="file-name-btn"
                        onClick={() => setPreviewFile(f)}
                      >
                        {f.name}
                      </button>
                      <span className="file-actions">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setPreviewFile(f)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="btn ghost danger"
                          onClick={() => removeFile(index, f.storagePath)}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint compact">No files yet — add one or more</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {previewFile && (
        <AttachmentPreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </section>
  );
}
