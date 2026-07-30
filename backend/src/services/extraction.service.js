const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const MAILTO_RE = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const LOCAL_MOBILE_RE = /\b03\d{2}[\s.-]?\d{7}\b|\b03\d{9}\b/g;
const CONTEXT_PHONE_RE = /(?:(?:ph|phone|call|tel|mobile|cell|whatsapp|wa|contact|reach(?:\s+me)?\s+at|\+)\b[:\s\-]*)(?:\+?\d{1,4}[\s.-]?)?\(?\b0?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/gi;
const WA_LINK_RE = /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d{8,15})/gi;
const WA_MENTION_RE = /(?:whatsapp|whats\s*app|wa\.me|dm\s*on\s*whatsapp|contact\s*on\s*whatsapp)[^\d+]{0,40}(\+?\d[\d\s\-()]{7,18}\d)/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d{3,4}[\s\-]?\d{3,4}(?:[\s\-]?\d{2,4})?/g;

function unescapePayload(rawStr) {
  return String(rawStr)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\\"/g, '"')
    .replace(/\\\"/g, '"')
    .replace(/\"/g, '"')
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

function cleanPhoneNumber(phoneStr) {
  if (!phoneStr) return null;
  let cleaned = phoneStr.replace(/^(?:ph|phone|call|tel|mobile|cell|whatsapp|wa|contact|reach(?:\s+me)?\s+at)[:\s\-]*/i, '').trim();
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 9 || digitsOnly.length > 13) return null;
  if (/^(17\d{11}|2707|7643|8145|5337|1785|1761)/.test(digitsOnly)) return null;
  if (/^(\d)\1+$/.test(digitsOnly)) return null;
  return cleaned;
}

function cleanPhoneAdvanced(p) {
  return String(p).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

function extractLineTexts(chunk) {
  const lines = [];
  const re = /"children"\s*:\s*\[\s*(?:null|\[[\s\S]*?\])\s*,\s*"((?:\\.|[^"\\])*)"\s*\]/g;
  let m;
  while ((m = re.exec(chunk)) !== null) {
    const line = unescapePayload(m[1]);
    if (line && line !== '$undefined') lines.push(line);
  }
  return lines;
}

function extractInitialContacts(rawStr) {
  const decodedBuffers = decodeBufferData(rawStr);
  const cleanText = unescapePayload(rawStr + ' ' + decodedBuffers);
  
  const foundEmails = [];
  let mailtoMatch;
  while ((mailtoMatch = MAILTO_RE.exec(cleanText)) !== null) {
    foundEmails.push(mailtoMatch[1].toLowerCase());
  }
  const standardEmails = cleanText.match(EMAIL_RE) || [];
  for (const e of standardEmails) foundEmails.push(e.toLowerCase());
  const uniqueEmails = [...new Set(foundEmails)];

  const candidatePhones = [];
  const localMatches = cleanText.match(LOCAL_MOBILE_RE) || [];
  candidatePhones.push(...localMatches);
  let contextMatch;
  while ((contextMatch = CONTEXT_PHONE_RE.exec(cleanText)) !== null) {
    candidatePhones.push(contextMatch[0]);
  }
  const uniquePhones = [...new Set(candidatePhones.map(cleanPhoneNumber).filter(Boolean))];

  return { emails: uniqueEmails, phones: uniquePhones, contextText: cleanText.substring(0, 5000) };
}

function extractPaginatedContacts(rawStr) {
  // 1. Extract emails from the ENTIRE decoded payload (safe because EMAIL_RE is very specific)
  const cleanText = unescapePayload(rawStr + ' ' + decodeBufferData(rawStr));
  const foundEmails = [];
  
  MAILTO_RE.lastIndex = 0;
  let mailtoMatch;
  while ((mailtoMatch = MAILTO_RE.exec(cleanText)) !== null) {
    foundEmails.push(mailtoMatch[1].toLowerCase());
  }
  
  const standardEmails = cleanText.match(EMAIL_RE) || [];
  for (const e of standardEmails) foundEmails.push(e.toLowerCase());
  
  const emails = [...new Set(foundEmails)];

  // 2. Extract phones only from human-readable text nodes to avoid random JSON numbers
  const text = extractLineTexts(rawStr).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const whatsappNumbers = [];
  for (const re of [WA_LINK_RE, WA_MENTION_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = cleanPhoneAdvanced(m[1]);
      if (n.replace(/\D/g, '').length >= 8) whatsappNumbers.push(n);
    }
  }
  const wa = [...new Set(whatsappNumbers)];

  const phones = [...new Set(
    (text.match(PHONE_RE) || [])
      .map(cleanPhoneAdvanced)
      .filter((p) => {
        const d = p.replace(/\D/g, '');
        return d.length >= 10 && d.length <= 15 && !wa.includes(p);
      })
  )];

  return { emails, phones: [...new Set([...wa, ...phones])], contextText: text.substring(0, 5000) };
}

module.exports = {
  extractInitialContacts,
  extractPaginatedContacts
};
