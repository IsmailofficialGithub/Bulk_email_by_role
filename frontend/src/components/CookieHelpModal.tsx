import { createPortal } from "react-dom";
import Image from "next/image";

type Props = {
  onClose: () => void;
};

export function CookieHelpModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" style={{ zIndex: 999999 }}>
      <div className="modal-card" style={{ maxWidth: "600px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--fg)" }}>How to Install the Cookie Extractor</h2>
          <button className="btn ghost icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <div className="step" style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--ok)", fontSize: "1rem" }}>Step 1: Download & Extract</h3>
            <p style={{ margin: "0 0 0.75rem 0", color: "var(--muted)", fontSize: "0.85rem", lineHeight: "1.5" }}>
              First, download the extension file below. <strong>CRITICAL: You must extract/unzip the file</strong> to a normal folder on your computer before proceeding!
            </p>
            <a 
              href="data:application/zip;base64,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" 
              download="automail-extension.zip"
              className="btn small"
              style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Download Extension (.zip)
            </a>
          </div>

          <div className="step" style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--ok)", fontSize: "1rem" }}>Step 2: Enable Developer Mode</h3>
            <p style={{ margin: "0 0 0.75rem 0", color: "var(--muted)", fontSize: "0.85rem", lineHeight: "1.5" }}>
              Open your browser and navigate to <code>chrome://extensions</code> (or <code>edge://extensions</code>). In the top right corner, toggle <strong>Developer mode</strong> ON.
            </p>
            <div style={{ position: "relative", width: "100%", height: "200px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Image src="/assets/dev_mode.png" alt="Developer mode toggle" fill style={{ objectFit: "cover", objectPosition: "top right" }} />
            </div>
          </div>

          <div className="step" style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--ok)", fontSize: "1rem" }}>Step 3: Load Unpacked</h3>
            <p style={{ margin: "0 0 0.75rem 0", color: "var(--muted)", fontSize: "0.85rem", lineHeight: "1.5" }}>
              In the top left corner, click <strong>Load unpacked</strong>. A file browser will open. Navigate to the folder where you <strong>extracted</strong> the extension and click "Select Folder".
            </p>
            <div style={{ position: "relative", width: "100%", height: "200px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Image src="/assets/load_unpacked.png" alt="Load unpacked button" fill style={{ objectFit: "cover", objectPosition: "top left" }} />
            </div>
          </div>

        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
