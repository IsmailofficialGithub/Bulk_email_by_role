const { chromium } = require("playwright");

const MAX_PAGES = 3;

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const asBullets = (texts) => texts.map((text) => ({ text }));

// Merge AI-rewritten content onto master data. Name, contact, companies, dates, project names,
// links, logins and education always come from master. tailored = null renders the full master resume.
function buildView(master, tailored) {
  if (!tailored) return { ...master, extraProjects: [] };

  for (const e of tailored.experience || []) {
    if (!master.experience.some((j) => j.id === e.id)) throw new Error(`Unknown job id: ${e.id}`);
  }
  const experience = master.experience.map((job) => {
    const sel = tailored.experience?.find((e) => e.id === job.id);
    return sel ? { ...job, title: sel.title || job.title, bullets: asBullets(sel.bullets) } : { ...job, bullets: job.bullets.slice(0, 2) };
  });

  const projects = tailored.projects.map((sel) => {
    const proj = master.projects.find((p) => p.id === sel.id);
    if (!proj) throw new Error(`Unknown project id: ${sel.id}`);
    return {
      ...proj,
      subtitle: sel.subtitle || proj.subtitle,
      description: sel.description || proj.description,
      tags: sel.tags?.length ? sel.tags : proj.tags,
      bullets: asBullets(sel.bullets),
    };
  });

  return {
    ...master,
    profile: { ...master.profile, headline: tailored.headline || master.profile.headline },
    // AI sometimes copies the job's "3+ years" ask; years always come from master.
    summary: (tailored.summary || master.summary).replace(/\b\d+\+?\s*years/gi, (m) => (master.summary.match(/\b\d+\+?\s*years/i) || [m])[0]),
    skills: tailored.skills?.length ? tailored.skills : master.skills,
    certifications: tailored.certifications?.length ? tailored.certifications : master.certifications,
    experience,
    projects,
    // Projects the AI did not pick still show as short one-liners on page 3.
    extraProjects: master.projects.filter((p) => !projects.some((sel) => sel.id === p.id)),
  };
}

// Plain text of the rendered resume, for ATS scoring.
function viewToText(v) {
  return [
    v.profile.name, v.profile.headline, "SUMMARY", v.summary,
    "SKILLS", ...v.skills.map((s) => `${s.category}: ${s.items.join(", ")}`),
    "EXPERIENCE", ...v.experience.flatMap((e) => [`${e.company} — ${e.title} (${e.dates})`, ...e.bullets.map((b) => `- ${b.text}`)]),
    "PROJECTS", ...v.projects.flatMap((p) => [`${p.name} - ${p.subtitle} [${p.tags.join(", ")}]`, p.description, ...p.bullets.map((b) => `- ${b.text}`)]),
    "CERTIFICATIONS", ...v.certifications, "EDUCATION", ...v.education,
  ].filter(Boolean).join("\n");
}

// Bold the lead phrase of a bullet (text before the first " — ", ":" or ","), else its first 4 words.
function keyed(text) {
  const m = text.match(/^(.{6,80}?)(?= — |: |, )/) || text.match(/^(\S+(?:\s+\S+){0,3})/);
  return m ? `<b>${esc(m[1])}</b>${esc(text.slice(m[1].length))}` : esc(text);
}

// "BSCS — GCUF | 2019 – 2023" -> degree, school, years
function parseEducation(line) {
  const [main, years = ""] = line.split(" | ");
  const [degree, school = ""] = main.split(" — ");
  return { degree, school, years };
}

function renderHtml(v) {
  const p = v.profile;
  const link = (l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`;
  const line1 = [esc(p.phone), `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`, p.location && esc(p.location)].filter(Boolean).join(" &nbsp;|&nbsp; ");
  const line2 = p.links.map(link).join(" &nbsp;|&nbsp; ");
  const bullets = (bs) => `<ul>${bs.map((b) => `<li>${keyed(b.text)}</li>`).join("")}</ul>`;
  const table = (rows) => `<table class="kv">${rows.map(([k, val]) => `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`).join("")}</table>`;
  const split = Math.min(5, Math.ceil(v.skills.length / 2) + 1);
  const expertise = v.skills.slice(0, split), tools = v.skills.slice(split);

  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { --accent: #4F46E5; --navy: #111827; --body: #374151; --muted: #6B7280; --tint: #EEF2FF; --soft: #C7D2FE; --rule: #E5E7EB; --card: #F9FAFB; }
  body { font-family: Helvetica, Inter, "Liberation Sans", Arial, sans-serif; font-size: 9.5pt; line-height: 13pt; color: var(--body); margin: 0; }
  a { color: var(--accent); text-decoration: underline; }
  p { margin: 0; text-align: justify; }
  header { background: var(--navy); border-bottom: 4pt solid var(--accent); padding: 16pt; color: #fff; }
  h1 { font-size: 26pt; line-height: 1.1; margin: 0; letter-spacing: .5px; }
  .role { color: var(--soft); font-weight: 700; font-size: 11pt; margin: 6pt 0 7pt; }
  .contact { font-size: 8.8pt; line-height: 13pt; }
  .contact a { color: #fff; }
  h2 { color: var(--accent); font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; margin: 14pt 0 7pt; padding-bottom: 3pt; border-bottom: .8pt solid var(--rule); break-after: avoid; }
  .stats { display: flex; background: var(--tint); margin-top: 10pt; padding: 8pt 0; }
  .stats div { flex: 1; text-align: center; border-left: 1px solid var(--soft); padding: 0 6pt; }
  .stats div:first-child { border-left: 0; }
  .stats b { display: block; color: var(--accent); font-size: 17pt; line-height: 20pt; }
  .stats span { display: block; font-size: 8pt; line-height: 10pt; color: var(--body); }
  table.kv { width: 100%; border-collapse: collapse; }
  .kv th { width: 24%; text-align: left; vertical-align: top; color: var(--navy); font-weight: 700; padding: 4pt 8pt 4pt 0; }
  .kv td { padding: 4pt 0; }
  .kv tr + tr th, .kv tr + tr td { border-top: 1px solid var(--rule); }
  .kv.steps th { width: 16%; }
  .job { margin-top: 10pt; break-inside: avoid; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; }
  .title { color: var(--navy); font-weight: 700; font-size: 10.6pt; }
  .date { color: var(--accent); font-weight: 700; font-size: 9pt; white-space: nowrap; }
  .where { color: var(--muted); font-size: 9pt; }
  .intro { color: var(--muted); font-style: italic; margin: 2pt 0; }
  ul { margin: 3pt 0 0; padding-left: 11pt; }
  li { margin: 2pt 0; text-align: justify; }
  li b { color: var(--navy); }
  .lead { color: var(--muted); margin-bottom: 6pt; }
  .card { background: var(--card); border: 1px solid var(--rule); border-left: 3pt solid var(--accent); padding: 10pt; margin-bottom: 8pt; break-inside: avoid; }
  .card .title { font-size: 10.4pt; }
  .tag { color: var(--muted); font-weight: 400; font-size: 9pt; }
  .card .desc { font-size: 8.8pt; margin-top: 2pt; }
  .card ul { list-style: none; padding-left: 10pt; }
  .card li::before { content: "– "; margin-left: -10pt; }
  .card .more { font-size: 8.8pt; margin-top: 3pt; }
  .extra { margin-bottom: 6pt; break-inside: avoid; }
  .edu { margin-top: 4pt; }
  .plain li { text-align: left; }
</style></head><body>
<header>
  <h1>${esc(p.name.toUpperCase())}</h1>
  <div class="role">${esc(p.headline)}</div>
  <div class="contact">${line1}<br>${line2}</div>
</header>
<h2>Professional Summary</h2>
<p>${esc(v.summary).replace(/(\d+\+?\s*years[^,.;]*)/i, "<b>$1</b>")}</p>
${v.stats?.length ? `<div class="stats">${v.stats.map((st) => `<div><b>${esc(st.value)}</b><span>${esc(st.label)}</span></div>`).join("")}</div>` : ""}
<h2>Areas of Expertise</h2>
${table(expertise.map((sk) => [sk.category, sk.items.join(", ")]))}
<h2>Professional Experience</h2>
${v.experience.map((e) => `<div class="job">
  <div class="row"><span class="title">${esc(e.title)}</span><span class="date">${esc(e.dates)}</span></div>
  <div class="where">${esc(e.company)}${e.location ? ` · ${esc(e.location)}` : ""}${e.type ? ` · ${esc(e.type)}` : ""}</div>
  ${e.intro ? `<div class="intro">${esc(e.intro)}</div>` : ""}
  ${bullets(e.bullets)}
</div>`).join("")}
<h2>Featured Projects</h2>
<div class="lead">Selected products built end-to-end, with the business problem each one solved.</div>
${v.projects.map((pr) => `<div class="card">
  <div class="title">${esc(pr.name)} <span class="tag">| ${esc(pr.subtitle)}</span></div>
  ${pr.description ? `<div class="desc">${esc(pr.description).replace(/\b(Problem|Fix|Result):/g, "<b>$1:</b>")}</div>` : ""}
  <ul>${pr.bullets.slice(0, 3).map((b) => `<li>${esc(b.text)}</li>`).join("")}</ul>
  <div class="more where">${esc(pr.tags.join(" · "))}${pr.note ? ` — ${esc(pr.note)}` : ""}${pr.login ? ` — ${esc(pr.login)}` : ""}</div>
  ${pr.link ? `<div class="more">View details: <a href="${esc(pr.link)}">${esc(pr.link.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></div>` : ""}
</div>`).join("")}
${v.extraProjects?.length ? `<h2>Additional Projects</h2>${v.extraProjects.map((pr) => `<div class="extra">
  <div class="title" style="font-size:10pt">${esc(pr.name)} <span class="tag">| ${esc(pr.subtitle)}</span></div>
  <p>${esc(pr.bullets[0]?.text || pr.description || "")}</p>
</div>`).join("")}` : ""}
${v.approach?.length ? `<h2>How I Work</h2>${`<table class="kv steps">${v.approach.map((a, i) => `<tr><th>${i + 1}. ${esc(a.step)}</th><td>${esc(a.text)}</td></tr>`).join("")}</table>`}` : ""}
${tools.length ? `<h2>Tools &amp; Technical Skills</h2>${table(tools.map((sk) => [sk.category, sk.items.join(", ")]))}` : ""}
<h2>Education</h2>
${v.education.map(parseEducation).map((ed) => `<div class="row edu"><span><span class="title" style="font-size:10pt">${esc(ed.degree)}</span>${ed.school ? `<br><span class="where">${esc(ed.school)}</span>` : ""}</span><span class="date">${esc(ed.years)}</span></div>`).join("")}
<h2>Certifications</h2>
<ul class="plain">${v.certifications.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<h2>Links</h2>
<div>${p.links.map(link).join(" &nbsp;·&nbsp; ")}</div>
</body></html>`;
}

function footer(v) {
  return `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5pt;color:#6B7280;padding:0 16mm;display:flex;justify-content:space-between;">
  <span>${esc(v.profile.name)} · ${esc(v.profile.headline.split("|")[0].trim())}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
}

function countPages(pdf) {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
}

async function renderPdf(html, footerHtml) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {}); // web font is optional; falls back to Liberation Sans
    return await page.pdf({
      format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: footerHtml,
      margin: { top: "11mm", bottom: "16mm", left: "16mm", right: "16mm" },
    });
  } finally {
    await browser.close();
  }
}

// Over MAX_PAGES: drop the least relevant (last) project, keeping at least 2; then cut every item to max 2 bullets.
async function generateResumePdf(master, tailored) {
  let t = tailored;
  for (;;) {
    const v = buildView(master, t);
    const pdf = await renderPdf(renderHtml(v), footer(v));
    const pages = countPages(pdf);
    if (!t || pages <= MAX_PAGES) return { pdf, pages, tailored: t };
    if (t.projects.length > 2) { t = { ...t, projects: t.projects.slice(0, -1) }; continue; }
    const two = (items) => (items || []).map((i) => ({ ...i, bullets: i.bullets.slice(0, 2) }));
    const trimmed = { ...t, experience: two(t.experience), projects: two(t.projects) };
    if (JSON.stringify(trimmed) === JSON.stringify(t)) throw new Error(`Resume is ${pages} pages, max is ${MAX_PAGES}`);
    t = trimmed;
  }
}

module.exports = { buildView, viewToText, renderHtml, generateResumePdf, countPages };
