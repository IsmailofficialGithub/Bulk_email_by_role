const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { z } = require("zod");
const { buildView } = require("./render");
const { trimJd } = require("./jd");

const OUTPUT_DIR = process.env.RESUME_OUTPUT_DIR || path.join(__dirname, "output");

const CAPS = { projects: 4, projectBullets: 4, jobBullets: 4, skills: 11 };

const SYSTEM_PROMPT = `You tailor a resume to a job description by SELECTING items from the candidate's data by ID.
Rules:
- Use only IDs that exist in the data. Never invent projects, jobs, bullets, skills or tags.
- Pick the ${CAPS.projects - 1}-${CAPS.projects} most relevant projects, most relevant first, with 2-${CAPS.projectBullets} bulletIds each.
- Include every job, with 2-${CAPS.jobBullets} bulletIds each, most relevant first.
- Order skill group IDs by relevance; leave out groups irrelevant to the job.
- tags: pick from that project's own tags only, most relevant first.
- description: one sentence (max 30 words) explaining the project in terms this job cares about. Facts only from the project's bullets.
- summary: 2-3 sentences, first person implied (no "I"), matched to the job, facts only from the data.
- If the text is not a job/hiring post, return {"skip": true, "reason": "<why>"}.
Return ONLY JSON in this shape:
{"summary":"","projects":[{"id":"p1","description":"","tags":[],"bulletIds":["p1b1"]}],"experience":[{"id":"e1","bulletIds":["e1b1"]}],"skillIds":["s1"],"keywords":[]}`;

const idList = z.array(z.string()).min(1);
const schema = z.object({
  summary: z.string().min(20).max(800),
  projects: z.array(z.object({
    id: z.string(),
    description: z.string().max(400).optional().default(""),
    tags: z.array(z.string()).optional().default([]),
    bulletIds: idList,
  })).min(1),
  experience: z.array(z.object({ id: z.string(), bulletIds: idList })),
  skillIds: idList,
  keywords: z.array(z.string()).optional().default([]),
});

// Only what the AI needs to choose: no contact info, certifications or education.
function compactMaster(m) {
  return JSON.stringify({
    skills: m.skills.map((s) => ({ id: s.id, category: s.category, items: s.items })),
    experience: m.experience.map((e) => ({ id: e.id, title: e.title, company: e.company, bullets: e.bullets })),
    projects: m.projects.map((p) => ({ id: p.id, name: p.name, subtitle: p.subtitle, tags: p.tags, bullets: p.bullets })),
  });
}

const uniq = (ids) => [...new Set(ids)];

function applyCaps(t) {
  return {
    ...t,
    projects: uniq(t.projects.map((p) => p.id))
      .slice(0, CAPS.projects)
      .map((id) => {
        const p = t.projects.find((x) => x.id === id);
        return { ...p, bulletIds: uniq(p.bulletIds).slice(0, CAPS.projectBullets) };
      }),
    experience: t.experience.map((e) => ({ ...e, bulletIds: uniq(e.bulletIds).slice(0, CAPS.jobBullets) })),
    skillIds: uniq(t.skillIds).slice(0, CAPS.skills),
  };
}

// callAi(systemPrompt, userPrompt) -> parsed JSON. Returns { skip, reason } or { tailored }.
async function tailorResume(master, jd, callAi) {
  const userPrompt = `CANDIDATE DATA:\n${compactMaster(master)}\n\nJOB DESCRIPTION:\n${jd}`;
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = attempt === 1 ? userPrompt : `${userPrompt}\n\nYour previous answer was invalid: ${lastError}. Fix it and return valid JSON.`;
    const raw = await callAi(SYSTEM_PROMPT, prompt);
    if (raw?.skip) return { skip: true, reason: raw.reason || "Not a job post" };

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      continue;
    }
    const tailored = applyCaps(parsed.data);
    try {
      buildView(master, tailored); // throws on any ID not in master
      return { tailored };
    } catch (err) {
      lastError = err.message;
    }
  }
  throw new Error(`AI output invalid after retry: ${lastError}`);
}

// Trims the JD, then caches by hash of (trimmed JD + master) so the same post never costs twice
// and editing master.json invalidates old entries.
async function tailorCached(master, jd, callAi) {
  const trimmed = trimJd(jd);
  if (trimmed.length < 30) return { skip: true, reason: "Post text too short to tailor" };

  const key = crypto.createHash("sha256").update(trimmed + JSON.stringify(master)).digest("hex");
  const file = path.join(OUTPUT_DIR, "cache", `${key}.json`);
  try {
    return { ...JSON.parse(fs.readFileSync(file, "utf8")), cached: true };
  } catch {} // cache miss

  const result = await tailorResume(master, trimmed, callAi);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result));
  return result;
}

module.exports = { tailorResume, tailorCached, trimJd, SYSTEM_PROMPT, CAPS, OUTPUT_DIR };
