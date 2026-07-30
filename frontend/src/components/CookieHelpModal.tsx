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
              href="/automail-extension.zip" 
              download
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
