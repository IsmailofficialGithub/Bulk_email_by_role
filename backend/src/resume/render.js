const { chromium } = require("playwright");

const MAX_PAGES = 2;

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pick(list, ids, what) {
  return ids.map((id) => {
    const found = list.find((x) => x.id === id);
    if (!found) throw new Error(`Unknown ${what} id: ${id}`);
    return found;
  });
}

// Merge AI selections onto master data. Names, links, dates and logins always come from master.
// tailored = null renders the full master resume (used to check the template).
function buildView(master, tailored) {
  if (!tailored) return master;

  const experience = master.experience.map((job) => {
    const sel = tailored.experience?.find((e) => e.id === job.id);
    return { ...job, bullets: sel ? pick(job.bullets, sel.bulletIds, "bullet") : job.bullets.slice(0, 2) };
  });

  const projects = tailored.projects.map((sel) => {
    const [proj] = pick(master.projects, [sel.id], "project");
    return {
      ...proj,
      description: sel.description || proj.description,
      tags: sel.tags?.length ? sel.tags.filter((t) => proj.tags.includes(t)) : proj.tags,
      bullets: pick(proj.bullets, sel.bulletIds, "bullet"),
    };
  });

  const skills = tailored.skillIds?.length ? pick(master.skills, tailored.skillIds, "skill") : master.skills;

  return { ...master, summary: tailored.summary || master.summary, experience, projects, skills };
}

function renderHtml(v) {
  const p = v.profile;
  const contact = [esc(p.phone), `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`]
    .concat(p.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`))
    .join(" &nbsp;|&nbsp; ");
  const bullets = (bs) => `<ul>${bs.map((b) => `<li>${esc(b.text)}</li>`).join("")}</ul>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.45in 0.55in; }
  body { font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; color: #222; line-height: 1.32; margin: 0; }
  a { color: #1155cc; }
  header { text-align: center; border-bottom: 1.5px solid #1f3864; padding-bottom: 8px; margin-bottom: 6px; }
  h1 { color: #1f3864; font-size: 21pt; margin: 0; letter-spacing: .5px; }
  .headline { color: #555; font-size: 11pt; margin: 2px 0; }
  .contact { color: #555; font-size: 9.5pt; }
  h2 { color: #1f3864; font-size: 11pt; text-transform: uppercase; border-bottom: 1.5px solid #1f3864; margin: 12px 0 5px; padding-bottom: 2px; }
  p { margin: 0; }
  .skills div { margin: 1px 0; }
  .row { display: flex; justify-content: space-between; margin-top: 7px; font-weight: bold; }
  .when { font-style: italic; color: #555; font-size: 9.5pt; }
  .proj { margin-top: 9px; break-inside: avoid; }
  .meta { font-style: italic; color: #555; font-size: 9.5pt; }
  ul { margin: 2px 0 0; padding-left: 16px; }
  li { margin: 1px 0; }
</style></head><body>
<header>
  <h1>${esc(p.name.toUpperCase())}</h1>
  <div class="headline">${esc(p.headline)}</div>
  <div class="contact">${contact}</div>
</header>
<h2>Professional Summary</h2>
<p>${esc(v.summary)}</p>
<h2>Technical Skills</h2>
<div class="skills">${v.skills.map((s) => `<div><b>${esc(s.category)}:</b> ${esc(s.items.join(", "))}</div>`).join("")}</div>
<h2>Professional Experience</h2>
${v.experience.map((e) => `<div class="row"><span>${esc(e.company)} — ${esc(e.title)}</span><span class="when">${esc(e.type)} - ${esc(e.dates)}</span></div>${bullets(e.bullets)}`).join("")}
<h2>Key Projects</h2>
${v.projects.map((pr) => `<div class="proj">
  <div><b>${pr.link ? `<a href="${esc(pr.link)}">${esc(pr.name)}</a>` : esc(pr.name)} - ${esc(pr.subtitle)}</b></div>
  ${pr.login ? `<div class="meta"><b>Login : ${esc(pr.login)}</b></div>` : ""}
  <div class="meta">${esc(pr.tags.join(", "))}${pr.note ? ` (${esc(pr.note)})` : ""}</div>
  ${pr.description ? `<p>${esc(pr.description)}</p>` : ""}
  ${bullets(pr.bullets)}
</div>`).join("")}
<h2>Certifications</h2>
<ul>${v.certifications.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<h2>Education</h2>
<ul>${v.education.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
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

module.exports = { buildView, renderHtml, generateResumePdf, countPages };
