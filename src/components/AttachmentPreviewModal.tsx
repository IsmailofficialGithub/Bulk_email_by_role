"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  file: File;
  onClose: () => void;
};

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function isText(file: File) {
  return (
    file.type.startsWith("text/") ||
    /\.(txt|md|csv|json|xml|html|css|js|ts|tsx|jsx|log)$/i.test(file.name)
  );
}

export function AttachmentPreviewModal({ file, onClose }: Props) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);

  const url = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  useEffect(() => {
    if (!isText(file)) return;
    let cancelled = false;
    file
      .text()
      .then((text) => {
        if (!cancelled) setTextContent(text.slice(0, 200_000));
      })
      .catch(() => {
        if (!cancelled) setTextError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="preview-title">{file.name}</h2>
            <p className="hint compact">
              {file.type || "unknown type"} ·{" "}
              {file.size > 1024 * 1024
                ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                : `${Math.round(file.size / 1024)} KB`}
            </p>
          </div>
          <div className="preview-actions">
            <a className="btn" href={url} download={file.name}>
              Download
            </a>
            <button type="button" className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="preview-body">
          {isImage(file) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file.name} className="preview-image" />
          ) : isPdf(file) ? (
            <iframe
              title={file.name}
              src={url}
              className="preview-frame"
            />
          ) : isText(file) ? (
            textError ? (
              <p className="hint">Could not read this file as text.</p>
            ) : textContent === null ? (
              <p className="hint">Loading preview…</p>
            ) : (
              <pre className="preview-text">{textContent}</pre>
            )
          ) : (
            <div className="preview-fallback">
              <p className="hint">
                No inline preview for this file type. Use Download to open it.
              </p>
              <a className="btn primary" href={url} download={file.name}>
                Download {file.name}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
