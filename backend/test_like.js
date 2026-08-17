const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testLike() {
  const { data: users } = await supabase.from('automailsend_app_state').select('*').limit(1);
  const user = users[0];
  const liAt = user.cookie_li_at;
  const jsessionid = user.cookie_jsessionid;

  let headers = {};
  const rawHeaders = user.auto_fetch_raw_headers || "{}";
  try {
    const parsed = JSON.parse(rawHeaders);
    if (parsed && Object.keys(parsed).length > 0) {
      headers = parsed;
    } else {
      throw new Error("empty");
    }
  } catch (e) {
    headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "x-restli-protocol-version": "2.0.0",
      "csrf-token": jsessionid.replace(/"/g, ''),
      "Cookie": `li_at=${liAt}; JSESSIONID="${jsessionid}";`
    };
  }

  // A random valid post URN (from the user's logs: urn:li:activity:7492895561692368897)
  const activityUrn = "urn:li:activity:7492895561692368897";
  
  console.log("Trying modern dash endpoint...");
  try {
    const res = await axios.post('https://www.linkedin.com/voyager/api/voyagerSocialDashReactions?action=create', {
      threadUrn: activityUrn,
      reactionType: "LIKE"
    }, { headers });
    console.log("Dash Success:", res.status);
  } catch (err) {
    console.error("Dash Error:", err.response ? err.response.status : err.message);
    if (err.response && err.response.data) console.error(JSON.stringify(err.response.data));
  }

  console.log("\nTrying older feed endpoint...");
  try {
    const res = await axios.post('https://www.linkedin.com/voyager/api/feed/likes', {
      objectUrn: activityUrn
    }, { headers });
    console.log("Feed Success:", res.status);
  } catch (err) {
    console.error("Feed Error:", err.response ? err.response.status : err.message);
    if (err.response && err.response.data) console.error(JSON.stringify(err.response.data));
  }
}

testLike();
