const express = require("express");
const { supabase } = require("../config/supabase");
const { generateResumePdf } = require("../resume/render");
const { tailorCached } = require("../resume/tailor");
const { callAiJson } = require("../resume/ai");

const router = express.Router();

// Preview only: returns the PDF, never sends email.
// Body: { userId, jd } or { userId, recipientId } (AI tailoring), or { tailored } (manual), or {} (full master).
// Add ?json=1 to get the AI selections instead of the PDF.
router.post("/preview", async (req, res) => {
  try {
    const master = require("../resume/master.json"); // loaded per request: gitignored file must not crash server start
    const { userId, recipientId } = req.body || {};
    let { jd, tailored = null } = req.body || {};
    let ats, claims;

    if (!tailored && (jd || recipientId)) {
      if (!userId || userId !== process.env.RESUME_TAILOR_USER_ID) return res.status(403).json({ error: "AI tailoring is only enabled for RESUME_TAILOR_USER_ID" });

      const { data: user, error } = await supabase
        .from("automailsend_app_state").select("ai_provider, ai_api_key").eq("user_id", userId).single();
      if (error || !user?.ai_api_key || !user.ai_provider || user.ai_provider === "none") {
        return res.status(400).json({ error: "No AI provider/key configured for this user" });
      }

      if (!jd) {
        const { data: rec } = await supabase
          .from("automailsend_recipients").select("context_text").eq("id", recipientId).eq("user_id", userId).single();
        jd = rec?.context_text;
        if (!jd) return res.status(404).json({ error: "Recipient not found or has no post text" });
      }

      const result = await tailorCached(master, jd, (s, u) => callAiJson(user.ai_provider, user.ai_api_key, s, u));
      if (result.skip) return res.status(422).json(result);
      tailored = result.tailored;
      ({ ats, claims } = result);
    }

    const out = await generateResumePdf(master, tailored);
    if (req.query.json) return res.json({ pages: out.pages, ats, claims, tailored: out.tailored });
    res.set({ "Content-Type": "application/pdf", "X-Resume-Pages": String(out.pages), ...(ats ? { "X-ATS-Score": String(ats.score) } : {}) });
    res.send(out.pdf);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
