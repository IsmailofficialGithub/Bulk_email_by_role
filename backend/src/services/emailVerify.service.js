const axios = require("axios");

// Ask the self-hosted Reacher server (check-if-email-exists) whether a mailbox exists.
// Returns "invalid" only when Reacher is sure; "safe"/"risky"/"unknown" or any error -> caller still sends.
async function checkEmail(email, url = process.env.REACHER_URL) {
  if (!url) return { reachable: "unknown", reason: "REACHER_URL not set" };
  try {
    const { data } = await axios.post(`${url}/v0/check_email`, { to_email: email }, { timeout: 60000 });
    return { reachable: data.is_reachable, reason: data.smtp?.error?.message || data.mx?.error?.message || "" };
  } catch (err) {
    return { reachable: "unknown", reason: `Reacher error: ${err.message}` };
  }
}

module.exports = { checkEmail };
