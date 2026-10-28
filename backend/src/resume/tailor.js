const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { z } = require("zod");
const { buildView, viewToText } = require("./render");
const { trimJd } = require("./jd");

const OUTPUT_DIR = process.env.RESUME_OUTPUT_DIR || path.join(__dirname, "output");
const CAPS = { projects: 4, bullets: 4, skillGroups: 8, skillItems: 14 };
const ATS_TARGET = 80;

const SYSTEM_PROMPT = `You rewrite a candidate's resume so it matches a job description as closely as possible and scores high in ATS (applicant tracking system) filters.
Rules:
- Mirror the job description's exact keywords and phrases (ATS matches literal terms): tech names, role title, responsibilities.
- headline: the target role title from the job + 3-4 matching specialties, separated by " | ".
- summary: 2-3 sentences aimed at this job, no "I". Keep the candidate's exact years of experience from their summary, never the number the job asks for.
- skills: 4-${CAPS.skillGroups} groups, most relevant first; put every skill the job asks for first in its group.
- experience: include every job by id. title may be adjusted toward the target role. 2-${CAPS.bullets} bullets each, rewritten with the job's keywords, action verb first, keep numbers/metrics, max 30 words each.
- projects: pick the ${CAPS.projects - 1}-${CAPS.projects} most relevant project ids, most relevant first. Rewrite subtitle, description (plain English for a non-technical business owner, max 60 words: "Problem: <business pain> Fix: <what was built> Result: <money, time or growth gained>", framed for this job's industry), tags (tech stack matched to the job) and 2-${CAPS.bullets} bullets (max 30 words each).
- certifications: reorder/reword the candidate's list, most relevant first.
- Never change ids. Company names, dates, project names and links are kept by code.
- If the text is not a job/hiring post, return {"skip": true, "reason": "<why>"}.
Return ONLY JSON in this shape:
{"headline":"","summary":"","skills":[{"category":"","items":[]}],"experience":[{"id":"e1","title":"","bullets":[""]}],"projects":[{"id":"p1","subtitle":"","description":"","tags":[],"bullets":[""]}],"certifications":[],"keywords":[]}`;

const ATS_PROMPT = `You are an ATS (applicant tracking system) and technical recruiter. Score how well the RESUME matches the JOB DESCRIPTION from 0 to 100 (keyword coverage, role/title fit, skills, experience relevance).
Return ONLY JSON: {"score":0,"missingKeywords":["important job keywords absent from the resume"],"tips":["max 3 short fixes"]}`;

const text = z.string().min(1);
const bullets = z.array(text).min(1);
const schema = z.object({
  headline: text.max(200),
  summary: z.string().min(20).max(900),
  skills: z.array(z.object({ category: text, items: z.array(text).min(1) })).min(1),
  experience: z.array(z.object({ id: text, title: z.string().optional().default(""), bullets })),
  projects: z.array(z.object({
    id: text,
    subtitle: z.string().optional().default(""),
    description: z.string().max(400).optional().default(""),
    tags: z.array(text).optional().default([]),
    bullets,
  })).min(1),
  certifications: z.array(text).optional().default([]),
  keywords: z.array(z.string()).optional().default([]),
});
const atsSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  missingKeywords: z.array(z.string()).optional().default([]),
  tips: z.array(z.string()).optional().default([]),
});

// Everything the AI may rewrite from; contact info and education stay out of the prompt.
function compactMaster(m) {
  return JSON.stringify({
    headline: m.profile.headline,
    summary: m.summary,
    skills: m.skills.map((s) => ({ category: s.category, items: s.items })),
    experience: m.experience.map((e) => ({ id: e.id, title: e.title, company: e.company, bullets: e.bullets.map((b) => b.text) })),
    projects: m.projects.map((p) => ({ id: p.id, name: p.name, subtitle: p.subtitle, tags: p.tags, bullets: p.bullets.map((b) => b.text) })),
    certifications: m.certifications,
  });
}

const uniqBy = (list, key) => list.filter((x, i) => list.findIndex((y) => key(y) === key(x)) === i);

function applyCaps(t) {
  return {
    ...t,
    skills: t.skills.slice(0, CAPS.skillGroups).map((s) => ({ ...s, items: [...new Set(s.items)].slice(0, CAPS.skillItems) })),
    experience: uniqBy(t.experience, (e) => e.id).map((e) => ({ ...e, bullets: e.bullets.slice(0, CAPS.bullets) })),
    projects: uniqBy(t.projects, (p) => p.id).slice(0, CAPS.projects).map((p) => ({ ...p, bullets: p.bullets.slice(0, CAPS.bullets) })),
  };
}

// What the AI added beyond master.json, so the user can review claims before an interview.
function diffClaims(master, t) {
  const known = new Set(master.skills.flatMap((s) => s.items).concat(master.projects.flatMap((p) => p.tags)).map((s) => s.toLowerCase()));
  const addedSkills = [...new Set(t.skills.flatMap((s) => s.items).concat(t.projects.flatMap((p) => p.tags)))]
    .filter((s) => !known.has(s.toLowerCase()));
  const changedTitles = t.experience
    .map((e) => ({ e, orig: master.experience.find((m) => m.id === e.id) }))
    .filter(({ e, orig }) => orig && e.title && e.title !== orig.title)
    .map(({ e, orig }) => `${orig.company}: "${orig.title}" -> "${e.title}"`);
  return { addedSkills, changedTitles };
}

async function askValid(callAi, system, prompt, zodSchema, check) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const p = attempt === 1 ? prompt : `${prompt}\n\nYour previous answer was invalid: ${lastError}. Fix it and return valid JSON.`;
    const raw = await callAi(system, p);
    if (raw?.skip) return { skip: true, reason: raw.reason || "Not a job post" };
    const parsed = zodSchema.safeParse(raw);
    if (!parsed.success) {
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      continue;
    }
    try {
      return { value: check ? check(parsed.data) : parsed.data };
    } catch (err) {
      lastError = err.message;
    }
  }
  throw new Error(`AI output invalid after retry: ${lastError}`);
}

async function scoreAts(master, tailored, jd, callAi) {
  const resumeText = viewToText(buildView(master, tailored));
  const r = await askValid(callAi, ATS_PROMPT, `JOB DESCRIPTION:\n${jd}\n\nRESUME:\n${resumeText}`, atsSchema);
  return r.value;
}

// callAi(systemPrompt, userPrompt) -> parsed JSON.
// Returns { skip, reason } or { tailored, ats, claims }. Rewrites once if the ATS score is below target.
async function tailorResume(master, jd, callAi) {
  const base = `CANDIDATE DATA:\n${compactMaster(master)}\n\nJOB DESCRIPTION:\n${jd}`;
  const tailorOnce = async (extra = "") => {
    const r = await askValid(callAi, SYSTEM_PROMPT, base + extra, schema, (t) => {
      const capped = applyCaps(t);
      buildView(master, capped); // throws on any id not in master
      return capped;
    });
    return r;
  };

  const first = await tailorOnce();
  if (first.skip) return first;
  let best = { tailored: first.value, ats: await scoreAts(master, first.value, jd, callAi) };

  if (best.ats.score < ATS_TARGET) {
    const extra = `\n\nA previous version scored ${best.ats.score}/100 in ATS. Missing keywords: ${best.ats.missingKeywords.join(", ")}. Fixes: ${best.ats.tips.join("; ")}. Include all of them.`;
    const second = await tailorOnce(extra);
    if (!second.skip) {
      const ats = await scoreAts(master, second.value, jd, callAi);
      if (ats.score > best.ats.score) best = { tailored: second.value, ats };
    }
  }
  return { ...best, claims: diffClaims(master, best.tailored) };
}

// Trims the JD, then caches by hash of (trimmed JD + master + prompts) so the same post never costs twice
// and editing master.json or the prompts invalidates old entries.
async function tailorCached(master, jd, callAi) {
  const trimmed = trimJd(jd);
  if (trimmed.length < 30) return { skip: true, reason: "Post text too short to tailor" };

  const key = crypto.createHash("sha256").update(trimmed + JSON.stringify(master) + SYSTEM_PROMPT + ATS_PROMPT).digest("hex");
  const file = path.join(OUTPUT_DIR, "cache", `${key}.json`);
  try {
    return { ...JSON.parse(fs.readFileSync(file, "utf8")), cached: true };
  } catch {} // cache miss

  const result = await tailorResume(master, trimmed, callAi);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result));
  return result;
}

module.exports = { tailorResume, tailorCached, trimJd, SYSTEM_PROMPT, CAPS, ATS_TARGET, OUTPUT_DIR };
