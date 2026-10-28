const { chromium } = require("playwright");

const MAX_PAGES = 2;

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
  if (!tailored) return master;

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

function renderHtml(v) {
  const p = v.profile;
  const contact = [p.location && esc(p.location), esc(p.phone), `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`]
    .concat(p.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`))
    .filter(Boolean)
    .join(" &nbsp;|&nbsp; ");
  const bullets = (bs) => `<ul>${bs.map((b) => `<li>${esc(b.text)}</li>`).join("")}</ul>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.4in 0.5in; }
  :root { --ink: #1d2433; --muted: #5b6475; --accent: #0f766e; --tint: #effaf8; --rule: #d9dee7; }
  body { font-family: "Source Sans 3", "Helvetica Neue", Carlito, Calibri, Arial, sans-serif; font-size: 10.2pt; color: var(--ink); line-height: 1.34; margin: 0; }
  a { color: inherit; text-decoration: none; }
  header { border-left: 5px solid var(--accent); padding: 2px 0 2px 12px; margin-bottom: 4px; }
  h1 { font-size: 23pt; margin: 0; letter-spacing: -.3px; font-weight: 700; }
  .headline { color: var(--accent); font-size: 11.5pt; font-weight: 600; margin: 1px 0 3px; }
  .contact { color: var(--muted); font-size: 9pt; }
  .contact a { color: var(--accent); }
  h2 { color: var(--accent); font-size: 9.5pt; letter-spacing: 1.6px; text-transform: uppercase; margin: 11px 0 5px; display: flex; align-items: center; gap: 8px; }
  h2::after { content: ""; flex: 1; border-top: 1px solid var(--rule); }
  h2, .row { break-after: avoid; }
  p { margin: 0; }
  .skills { display: grid; grid-template-columns: 1.75in 1fr; gap: 2px 10px; }
  .skills b { color: var(--muted); font-weight: 600; }
  .job { margin-top: 7px; break-inside: avoid; }
  .row { display: flex; justify-content: space-between; align-items: baseline; }
  .title { font-weight: 700; font-size: 10.6pt; }
  .org { color: var(--accent); font-weight: 600; }
  .when { color: var(--muted); font-size: 9pt; white-space: nowrap; }
  .proj { margin-top: 8px; break-inside: avoid; }
  .meta { color: var(--muted); font-size: 8.8pt; }
  .impact { background: var(--tint); border-left: 3px solid var(--accent); padding: 3px 8px; margin: 3px 0 2px; font-size: 9.6pt; }
  ul { margin: 2px 0 0; padding-left: 15px; }
  li { margin: 1px 0; }
  li::marker { color: var(--accent); }
  .plain { list-style: none; padding: 0; }
</style></head><body>
<header>
  <h1>${esc(p.name)}</h1>
  <div class="headline">${esc(p.headline)}</div>
  <div class="contact">${contact}</div>
</header>
<h2>Summary</h2>
<p>${esc(v.summary)}</p>
<h2>Skills</h2>
<div class="skills">${v.skills.map((s) => `<b>${esc(s.category)}</b><span>${esc(s.items.join(" · "))}</span>`).join("")}</div>
<h2>Experience</h2>
${v.experience.map((e) => `<div class="job"><div class="row"><span class="title">${esc(e.title)} <span class="org">· ${esc(e.company)}</span></span><span class="when">${esc(e.dates)}${e.type ? ` · ${esc(e.type)}` : ""}</span></div>${bullets(e.bullets)}</div>`).join("")}
<h2>Selected Projects</h2>
${v.projects.map((pr) => `<div class="proj">
  <div class="row"><span class="title">${pr.link ? `<a href="${esc(pr.link)}">${esc(pr.name)}</a>` : esc(pr.name)} <span class="org">· ${esc(pr.subtitle)}</span></span>${pr.link ? `<span class="when"><a href="${esc(pr.link)}">${esc(pr.link.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></span>` : ""}</div>
  <div class="meta">${esc(pr.tags.join(" · "))}${pr.note ? ` — ${esc(pr.note)}` : ""}${pr.login ? ` — ${esc(pr.login)}` : ""}</div>
  ${pr.description ? `<div class="impact">${esc(pr.description).replace(/\b(Problem|Fix|Result):/g, "<b>$1:</b>")}</div>` : ""}
  ${bullets(pr.bullets)}
</div>`).join("")}
<h2>Certifications</h2>
<ul class="plain">${v.certifications.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<h2>Education</h2>
<ul class="plain">${v.education.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
</body></html>`;
}

function countPages(pdf) {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
}

async function renderPdf(html) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({ format: "Letter", printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}

// Over MAX_PAGES: drop the least relevant (last) project and re-render, keeping at least 2.
async function generateResumePdf(master, tailored) {
  let t = tailored;
  for (;;) {
    const pdf = await renderPdf(renderHtml(buildView(master, t)));
    const pages = countPages(pdf);
    if (!t || pages <= MAX_PAGES) return { pdf, pages, tailored: t };
    if (t.projects.length <= 2) throw new Error(`Resume is ${pages} pages, max is ${MAX_PAGES}`);
    t = { ...t, projects: t.projects.slice(0, -1) };
  }
}

module.exports = { buildView, viewToText, renderHtml, generateResumePdf, countPages };
