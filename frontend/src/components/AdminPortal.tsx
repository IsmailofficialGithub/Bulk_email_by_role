import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

type UserState = {
  user_id: string;
  is_blocked: boolean;
  allowed_products: string[];
  config: any;
  auto_fetch: any;
  automail: any;
  created_at: string;
};

type GlobalSettings = {
  min_fetch_interval: number;
  min_pagination_delay: number;
  max_pagination_limit: number;
  allow_signups: boolean;
};

export function AdminPortal() {
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [users, setUsers] = useState<UserState[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings Form State
  const [minInterval, setMinInterval] = useState(5);
  const [minDelay, setMinDelay] = useState(5);
  const [maxLimit, setMaxLimit] = useState(10);
  const [allowSignups, setAllowSignups] = useState(true);
  
  // View Config Modal State
  const [viewUser, setViewUser] = useState<UserState | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = session ? { "Authorization": `Bearer ${session.access_token}` } : {};
      const [settingsRes, usersRes] = await Promise.all([
        fetch("/api/admin/global-settings", { headers }),
        fetch("/api/admin/users", { headers })
      ]);
      
      const settingsData = await settingsRes.json();
      const usersData = await usersRes.json();
      
      if (settingsData.success) {
        setGlobalSettings(settingsData.data);
        setMinInterval(settingsData.data.min_fetch_interval || 5);
        setMinDelay(settingsData.data.min_pagination_delay || 5);
        setMaxLimit(settingsData.data.max_pagination_limit || 10);
        setAllowSignups(settingsData.data.allow_signups !== false);
      }
      
      if (usersData.success) {
        setUsers(usersData.data);
      }
    } catch (err) {
      toast.error("Failed to fetch admin data");
    }
    setLoading(false);
  }

  async function saveGlobalSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 
        "Content-Type": "application/json",
        ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {})
      };

      const res = await fetch("/api/admin/global-settings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          min_fetch_interval: minInterval,
          min_pagination_delay: minDelay,
          max_pagination_limit: maxLimit,
          allow_signups: allowSignups
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Global settings updated!");
        setGlobalSettings(data.data);
      } else {
        toast.error(data.error || "Failed to update global settings");
      }
    } catch (err) {
      toast.error("Network error");
    }
  }

  async function toggleBlock(userId: string, currentBlocked: boolean) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 
        "Content-Type": "application/json",
        ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {})
      };

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: userId, is_blocked: !currentBlocked })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(currentBlocked ? "User unblocked" : "User blocked");
        setUsers(users.map(u => u.user_id === userId ? { ...u, is_blocked: !currentBlocked } : u));
      } else {
        toast.error(data.error || "Failed to update user");
      }
    } catch (err) {
      toast.error("Network error");
    }
  }

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading admin data...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <section className="panel">
        <h2 className="panel-title">Global Limits & Settings (Backend Cache)</h2>
        <p className="hint">These settings apply to all users and are strictly enforced by the backend.</p>
        
        <div className="grid-2" style={{ marginTop: "1rem" }}>
          <label className="field">
            <span>Minimum Fetch Interval (Minutes)</span>
            <input 
              type="number" 
              value={minInterval} 
              onChange={e => setMinInterval(Number(e.target.value))} 
            />
          </label>
          <label className="field">
            <span>Minimum Pagination Delay (Seconds)</span>
            <input 
              type="number" 
              value={minDelay} 
              onChange={e => setMinDelay(Number(e.target.value))} 
            />
          </label>
          <label className="field">
            <span>Maximum Pagination Limit (Pages)</span>
            <input 
              type="number" 
              value={maxLimit} 
              onChange={e => setMaxLimit(Number(e.target.value))} 
            />
          </label>
          <label className="field">
            <span>Allow New User Signups</span>
            <select 
              value={allowSignups ? "true" : "false"}
              onChange={e => setAllowSignups(e.target.value === "true")}
              style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--bg-input)" }}
            >
              <option value="true">Yes, signups are open</option>
              <option value="false">No, signups are closed</option>
            </select>
          </label>
        </div>
        <button className="btn primary" style={{ marginTop: "1rem" }} onClick={saveGlobalSettings}>
          Save Global Settings
        </button>
      </section>

      <section className="panel">
        <h2 className="panel-title">User Management</h2>
        <p className="hint">Block users or edit their configurations.</p>
        
        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 0.5rem" }}>User ID</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Joined</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.75rem 0.5rem", fontFamily: "monospace" }}>{u.user_id}</td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    {u.is_blocked ? (
                      <span className="badge err">Blocked</span>
                    ) : (
                      <span className="badge ok">Active</span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem", display: "flex", gap: "0.5rem" }}>
                    <button 
                      className={`btn small ${u.is_blocked ? "ok" : "danger"}`} 
                      onClick={() => toggleBlock(u.user_id, u.is_blocked)}
                    >
                      {u.is_blocked ? "Unblock" : "Block"}
                    </button>
                    <button 
                      className="btn small" 
                      onClick={() => setViewUser(u)}
                    >
                      View Config
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewUser && (
        <div className="modal-backdrop" onClick={() => setViewUser(null)} style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: "800px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="panel-title">User Configuration</h2>
              <button className="btn ghost icon" onClick={() => setViewUser(null)}>✕</button>
            </div>
            <p className="hint" style={{ marginTop: "0.25rem", fontFamily: "monospace" }}>{viewUser.user_id}</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem", maxHeight: "60vh", overflowY: "auto" }}>
              <div style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px" }}>
                <strong style={{ color: "var(--accent)" }}>Auto-Fetch Config</strong>
                <pre style={{ fontSize: "0.75rem", overflowX: "auto", margin: 0, marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(viewUser.auto_fetch, null, 2)}
                </pre>
              </div>
              <div style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px" }}>
                <strong style={{ color: "var(--accent)" }}>Automail AI Config</strong>
                <pre style={{ fontSize: "0.75rem", overflowX: "auto", margin: 0, marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(viewUser.automail, null, 2)}
                </pre>
              </div>
              <div style={{ background: "var(--bg-panel)", padding: "1rem", borderRadius: "8px" }}>
                <strong style={{ color: "var(--accent)" }}>SMTP Config (Hidden)</strong>
                <pre style={{ fontSize: "0.75rem", overflowX: "auto", margin: 0, marginTop: "0.5rem" }}>
                  Configured: {viewUser.config?.configured ? "Yes" : "No"}
                  <br />
                  Host: {viewUser.config?.host}
                  <br />
                  User: {viewUser.config?.user}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
