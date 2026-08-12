import { createPortal } from "react-dom";
import Image from "next/image";

type Props = {
  onClose: () => void;
};

export function CookieHelpModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" style={{ zIndex: 999999 }}>
      <div className="modal-card" style={{ maxWidth: "800px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", position: "sticky", top: 0, background: "var(--bg)", paddingBottom: "1rem", borderBottom: "1px solid var(--line)" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem", color: "var(--fg)" }}>A to Z Setup Tutorial</h2>
            <p className="hint compact">Everything you need to know to configure Auto-Fetch perfectly.</p>
          </div>
          <button className="btn ghost icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          <section>
            <h3 style={{ color: "var(--accent)", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>1. Keywords & Roles</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "1rem" }}>
              This is the heart of the auto-fetcher. You tell the system what to search for on LinkedIn, and which email template to use when it finds someone.
            </p>
            <ul style={{ color: "var(--fg)", fontSize: "0.9rem", lineHeight: "1.6", paddingLeft: "1.5rem" }}>
              <li><strong>Keyword:</strong> What to search for (e.g., "startup founder", "react developer").</li>
              <li><strong>Role:</strong> The category to assign to these leads. This determines which email template will be automatically sent to them.</li>
              <li><strong>Limit:</strong> You can add a maximum of 3 keywords to keep your searches safe and targeted.</li>
            </ul>
          </section>

          <section>
            <h3 style={{ color: "var(--accent)", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>2. Search Settings (Safety & Frequency)</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "1rem" }}>
              LinkedIn actively monitors bot activity. These settings help you mimic human behavior so your account stays safe.
            </p>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px" }}>
                <strong style={{ color: "var(--fg)", display: "block", marginBottom: "0.25rem" }}>Fetch Interval (Minutes)</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>How often the background worker wakes up to perform a search. <strong>Recommendation: 5 to 10 minutes.</strong> Anything less than 5 minutes might trigger LinkedIn's spam filters.</span>
              </div>
              <div style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px" }}>
                <strong style={{ color: "var(--fg)", display: "block", marginBottom: "0.25rem" }}>Pagination Limit</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>How many pages of search results to scrape per keyword. <strong>Recommendation: 3 pages.</strong> It's better to scrape a few pages often, rather than many pages at once.</span>
              </div>
              <div style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px" }}>
                <strong style={{ color: "var(--fg)", display: "block", marginBottom: "0.25rem" }}>Pagination Delay (Sec)</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>The wait time between clicking "Next Page". <strong>Recommendation: 10 to 15 seconds.</strong> Humans don't click instantly; your scraper shouldn't either.</span>
              </div>
              <div style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px" }}>
                <strong style={{ color: "var(--fg)", display: "block", marginBottom: "0.25rem" }}>Post Age Filter</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Restricts searches to recent posts. <strong>Recommendation: Past 24 hours.</strong> This ensures you are reaching out to highly active users.</span>
              </div>
            </div>
          </section>

          <section>
            <h3 style={{ color: "var(--accent)", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>3. LinkedIn Cookies (The Credentials)</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "1rem" }}>
              To perform searches on your behalf, the system needs your temporary session tokens (<code>li_at</code> and <code>JSESSIONID</code>). You have two ways to provide them:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className="step" style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--ok)" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--ok)", fontSize: "1rem" }}>Method A: Use the Official Extension (Easiest)</h4>
                <ol style={{ margin: 0, paddingLeft: "1.5rem", color: "var(--fg)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                  <li>Click the <strong>Download Extension (.zip)</strong> button in the settings modal.</li>
                  <li>Extract the downloaded <code>.zip</code> file to a folder on your computer.</li>
                  <li>Open your browser and go to <code>chrome://extensions</code>.</li>
                  <li>Turn on <strong>Developer mode</strong> (top right).</li>
                  <li>Click <strong>Load unpacked</strong> (top left) and select the folder you just extracted.</li>
                  <li>Go to LinkedIn.com and make sure you are logged in.</li>
                  <li>Come back to this app and click the <strong>Auto-Detect JSESSIONID</strong> button. It will magically grab all required tokens and headers!</li>
                </ol>
              </div>

              <div className="step" style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--fg)", fontSize: "1rem" }}>Method B: Manual Smart Paste (Advanced)</h4>
                <p style={{ margin: "0 0 0.75rem 0", color: "var(--muted)", fontSize: "0.85rem", lineHeight: "1.5" }}>
                  If you don't want to install the extension, you can grab the tokens manually from your browser's network tab.
                </p>
                <ol style={{ margin: 0, paddingLeft: "1.5rem", color: "var(--fg)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                  <li>Go to LinkedIn.com and open Developer Tools (Right click &gt; Inspect &gt; Network tab).</li>
                  <li>Refresh the page and click on any request (e.g., a request starting with <code>voyager...</code>).</li>
                  <li>Scroll down to the <strong>Request Headers</strong> section.</li>
                  <li>Right-click the entire Request Headers block and select "Copy value" (or copy the Cookie string and csrf-token).</li>
                  <li>Paste this text directly into the <strong>Smart Paste</strong> box in our settings. The system will auto-extract <code>li_at</code>, <code>JSESSIONID</code>, and any missing headers!</li>
                </ol>
              </div>
            </div>
          </section>

          <section>
            <h3 style={{ color: "var(--accent)", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>4. Enable and Save</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Once you have at least 1 keyword and your LinkedIn cookies are successfully loaded (you'll see green checkmarks), you can toggle <strong>Enable Auto-Fetch</strong> to Active. 
              <br /><br />
              Click <strong>Save Configuration</strong>. The system will perform a quick test to verify your tokens are valid. Once saved, the background worker will take over and start finding leads for you automatically!
            </p>
          </section>

        </div>

        <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg)", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
          <button className="btn primary" onClick={onClose}>
            I'm Ready, Let's Go!
          </button>
        </div>
      </div>
    </div>
  );
}
