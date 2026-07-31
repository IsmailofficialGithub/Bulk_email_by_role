const axios = require('axios');
const fs = require('fs');
const path = require('path');

const headers = {
  "Accept": "application/json",
  "Content-Type": "application/json",
  "Origin": "https://www.linkedin.com",
  "Referer": "https://www.linkedin.com/preload/?_bprMode=vanilla",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  "x-restli-protocol-version": "2.0.0",
  "csrf-token": "ajax:4390249297358278176",
  "Cookie": "li_at=AQEDAUn6boEBY1TcAAABn7Ae8qsAAAGf1Ct2q04AKRdG6R0KsoZ04IggzW49jidkH8qJmQkQ74tV5nf41NJTt8IEswTjOoP4ZvvOPs7oUe7zLEI26zh_9SZcFPZcTrp6pV8akhih3GylxhhZOkIsou9u; JSESSIONID=\"ajax:4390249297358278176\";"
};

const keyword = "Hiring Full stack developer";
const keywordsQuery = encodeURIComponent(keyword);
const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${keywordsQuery}&origin=SWITCH_SEARCH_VERTICAL`;

async function testFetch() {
  try {
    console.log(`Fetching from: ${searchUrl}`);
    const response = await axios.get(searchUrl, { headers, responseType: 'text' });
    
    console.log(`HTTP ${response.status} - Data length: ${response.data.length}`);
    
    // Ensure scripts directory exists
    const scriptsDir = path.join(__dirname);
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }
    
    // Save raw response to a file so we can analyze the structure
    const outPath = path.join(scriptsDir, 'test_response.txt');
    fs.writeFileSync(outPath, response.data);
    console.log(`Raw response saved to ${outPath}`);
    
    // We'll also try a rudimentary unescape to make it readable
    const unescaped = unescapePayload(response.data);
    const unescapedOutPath = path.join(scriptsDir, 'test_response_unescaped.txt');
    fs.writeFileSync(unescapedOutPath, unescaped);
    console.log(`Unescaped response saved to ${unescapedOutPath}`);

  } catch (err) {
    console.error("Error fetching data:", err.message);
    if (err.response) {
      console.error(err.response.data);
    }
  }
}

function unescapePayload(rawStr) {
  return String(rawStr)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\\"/g, '"')
    .replace(/\\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

testFetch();
