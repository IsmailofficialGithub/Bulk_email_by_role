const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabase");

// Middleware to verify auth token and get user
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return res.status(401).json({ success: false, error: "Unauthorized" });
  req.user = user;
  next();
}

// GET /api/linkedin/connect
router.get("/connect", verifyAuth, async (req, res) => {
  try {
    const { data: appState } = await supabase
      .from("automailsend_app_state")
      .select("allowed_products")
      .eq("user_id", req.user.id)
      .single();

    if (!appState || !appState.allowed_products?.includes("linkedin")) {
      return res.status(403).json({ success: false, error: "Product access not granted" });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    const scope = "w_member_social profile openid email";

    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, error: "LinkedIn OAuth not configured" });
    }

    const state = req.user.id;
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;

    res.json({ success: true, url: authUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/linkedin/callback
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;
  // Redirect to frontend dashboard (defaulting to localhost if env missing)
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  if (error) {
    return res.redirect(`${frontendUrl}/settings?openModel=ture&error=${error}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/settings?openModel=ture&error=invalid_request`);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(`${frontendUrl}/settings?openModel=ture&error=server_configuration_error`);
  }

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("LinkedIn token error:", tokenData);
      return res.redirect(`${frontendUrl}/settings?openModel=ture&error=token_exchange_failed`);
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { "Authorization": `Bearer ${access_token}` }
    });
    
    const profileData = await profileRes.json();
    if (!profileRes.ok) {
      console.error("LinkedIn profile error:", profileData);
      return res.redirect(`${frontendUrl}/settings?openModel=ture&error=profile_fetch_failed`);
    }

    const linkedinPersonUrn = `urn:li:person:${profileData.sub}`;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
    
    const { error: dbError } = await supabase
      .from("linkedin_accounts")
      .upsert({
        user_id: state, // user id from state
        linkedin_person_urn: linkedinPersonUrn,
        access_token,
        refresh_token: refresh_token || null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("Supabase upsert error:", dbError);
      return res.redirect(`${frontendUrl}/settings?openModel=ture&error=database_error`);
    }

    return res.redirect(`${frontendUrl}/settings?openModel=ture&linkedin_connected=true`);

  } catch (err) {
    console.error("LinkedIn OAuth Callback error:", err);
    return res.redirect(`${frontendUrl}/settings?openModel=ture&error=internal_server_error`);
  }
});

// POST /api/linkedin/disconnect
router.post("/disconnect", verifyAuth, async (req, res) => {
  try {
    const { error: deleteError } = await supabase
      .from("linkedin_accounts")
      .delete()
      .eq("user_id", req.user.id);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: "Disconnected successfully" });
  } catch (err) {
    console.error("Disconnect error:", err.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// GET /api/linkedin/verify-identity
router.get("/verify-identity", verifyAuth, async (req, res) => {
  try {
    const { data: linkedinAccount } = await supabase
      .from("linkedin_accounts")
      .select("access_token")
      .eq("user_id", req.user.id)
      .single();

    if (!linkedinAccount || !linkedinAccount.access_token) {
      return res.json({ success: true, match: null, message: "No OAuth connected" });
    }

    const { data: appStateData } = await supabase
      .from("automailsend_app_state")
      .select("state")
      .eq("user_id", req.user.id)
      .single();

    const cookies = appStateData?.state?.autoFetch;
    if (!cookies || !cookies.liAt || !cookies.jsessionid) {
      return res.json({ success: true, match: null, message: "No Cookies set" });
    }

    // 1. Get OAuth Profile Name
    const oauthRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { "Authorization": `Bearer ${linkedinAccount.access_token}` }
    });
    if (!oauthRes.ok) throw new Error("Failed to fetch OAuth profile");
    const oauthProfile = await oauthRes.json();
    const oauthName = `${oauthProfile.given_name} ${oauthProfile.family_name}`.trim().toLowerCase();

    // 2. Get Cookie Profile Name
    const cookieRes = await fetch("https://www.linkedin.com/voyager/api/me", {
      headers: {
        "Cookie": `li_at=${cookies.liAt}; JSESSIONID=${cookies.jsessionid}`,
        "Csrf-Token": cookies.jsessionid.replace(/"/g, ''),
        "x-restli-protocol-version": "2.0.0"
      }
    });
    if (!cookieRes.ok) throw new Error("Failed to fetch Cookie profile");
    const cookieProfile = await cookieRes.json();
    const cookieName = `${cookieProfile.miniProfile?.firstName} ${cookieProfile.miniProfile?.lastName}`.trim().toLowerCase();

    const match = oauthName === cookieName;

    res.json({ 
      success: true, 
      match, 
      oauthName, 
      cookieName 
    });
  } catch (err) {
    console.error("Verify Identity error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
