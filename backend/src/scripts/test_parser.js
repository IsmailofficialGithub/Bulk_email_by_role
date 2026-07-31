const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, 'test_response.txt');
const rawData = fs.readFileSync(outPath, 'utf8');

// The logic we will use for the extraction service
function unescapePayload(rawStr) {
  return String(rawStr)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\\"/g, '"')
    .replace(/\\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\\\/g, '\\');
}

function decodeBufferData(rawStr) {
  const bufferRegex = /"data"\s*:\s*\[([\d,\s]+)\]/g;
  let decoded = '';
  let match;
  while ((match = bufferRegex.exec(rawStr)) !== null) {
    try {
      const numbers = match[1].split(',').map((n) => parseInt(n.trim(), 10));
      decoded += ' ' + String.fromCharCode(...numbers);
    } catch (e) { }
  }
  return decoded;
}

function extractContactsWithSource(rawStr) {
  const cleanText = unescapePayload(rawStr + ' ' + decodeBufferData(rawStr));
  
  // 1. Extract URLs
  const urlMatches = cleanText.match(/"postSlugUrl"\s*:\s*"([^"]+)"/g) || [];
  const uniqueUrls = [...new Set(urlMatches.map(m => m.match(/"postSlugUrl"\s*:\s*"([^"]+)"/)[1]))];
  
  // We will just join all URLs found in this chunk.
  const source_urls = uniqueUrls.join(", ");
  
  // 2. Extract Emails (Simplified for test)
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const emails = [...new Set((cleanText.match(EMAIL_RE) || []).filter(e => !e.includes('linkedin.com')))];
  
  return {
    emails,
    source_urls
  };
}

const result = extractContactsWithSource(rawData);
console.log("=== EXTRACTION RESULT ===");
console.log("Found Emails:", result.emails);
console.log("Found Source URLs:\n", result.source_urls.split(', ').join('\n '));
