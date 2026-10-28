const fs = require("fs");
const path = require("path");
const master = require("./master.json");
const { generateResumePdf } = require("./render");
const { tailorCached, OUTPUT_DIR } = require("./tailor");
const { callAiJson } = require("./ai");

const TIMEOUT_MS = 90000;
const RESUME_FILE = /resume|cv/i;

const isEnabled = () => process.env.RESUME_TAILOR === "on";

// Returns { pdf, filename } or { skip, reason }. Throws on failure/timeout so the caller can fall back.
async function tailorForRecipient(recipient, provider, apiKey) {
  const work = (async () => {
    const result = await tailorCached(master, recipient.context_text, (s, u) => callAiJson(provider, apiKey, s, u));
    if (result.skip) return result;

    const { pdf } = await generateResumePdf(master, result.tailored);
    const filename = `${master.profile.name.replace(/\s+/g, "_")}_Resume.pdf`;
    const dir = path.join(OUTPUT_DIR, "pdfs");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${new Date().toISOString().slice(0, 10)}_${recipient.id}.pdf`), pdf);
    return { pdf, filename };
  })();

  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Resume tailoring timed out")), TIMEOUT_MS); });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Template files minus the resume/cv one, plus the tailored PDF.
function withTailoredResume(templateFiles, tailored) {
  const others = (templateFiles || [])
    .filter((a) => !RESUME_FILE.test(a.name || ""))
    .map((a) => ({ filename: a.name, href: a.url, contentType: a.type }));
  return [...others, { filename: tailored.filename, content: tailored.pdf, contentType: "application/pdf" }];
}

module.exports = { isEnabled, tailorForRecipient, withTailoredResume };
