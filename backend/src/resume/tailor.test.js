// Run: node --test src/resume/tailor.test.js
const test = require("node:test");
const assert = require("node:assert");
const master = require("./master.json");
const { tailorResume } = require("./tailor");
const { generateResumePdf, buildView } = require("./render");

const good = {
  headline: "Senior DevOps Engineer | AWS | Kubernetes | Terraform",
  summary: "DevOps engineer focused on AWS, Kubernetes and Terraform production systems.",
  skills: [{ category: "Cloud", items: ["AWS", "EKS", "Java"] }],
  experience: [{ id: "e2", title: "DevOps Engineer", bullets: ["Built CI/CD with GitHub Actions."] }],
  projects: [
    { id: "p3", subtitle: "Streaming on EKS", description: "Streaming infra on EKS.", tags: ["EKS"], bullets: ["Ran EKS with HPA."] },
    { id: "p6", bullets: ["Terraform-managed VPC and RDS."] },
  ],
};

// Fake AI: tailoring calls get `tailorAnswers` in order, ATS calls get `scores` in order.
function fakeAi(tailorAnswers, scores = [90]) {
  const calls = { tailor: 0, ats: 0 };
  const fn = async (system) => {
    if (system.startsWith("You are an ATS")) return { score: scores[calls.ats++], missingKeywords: ["Helm"], tips: [] };
    return tailorAnswers[calls.tailor++];
  };
  fn.calls = calls;
  return fn;
}

test("rewritten content renders; locked fields come from master", async () => {
  const { tailored, ats } = await tailorResume(master, "DevOps JD", fakeAi([good]));
  const v = buildView(master, tailored);
  assert.equal(ats.score, 90);
  assert.equal(v.profile.headline, good.headline);
  assert.equal(v.profile.email, master.profile.email);
  const encs = v.experience.find((e) => e.id === "e2");
  assert.equal(encs.title, "DevOps Engineer");
  assert.equal(encs.company, "ENCS");
  assert.equal(encs.dates, master.experience[1].dates);
  assert.equal(v.projects[0].link, "https://offstream.co/");
  assert.equal(v.projects[0].bullets[0].text, "Ran EKS with HPA.");
});

test("claims list added skills and changed titles", async () => {
  const { claims } = await tailorResume(master, "JD", fakeAi([good]));
  assert.deepStrictEqual(claims.addedSkills, ["AWS", "Java"]);
  assert.deepStrictEqual(claims.changedTitles, ['ENCS: "Backend Developer / DevOps Engineer" -> "DevOps Engineer"']);
});

test("low ATS score triggers one rewrite and keeps the better version", async () => {
  const better = { ...good, summary: "Better summary with Helm, AWS and Kubernetes experience." };
  const ai = fakeAi([good, better], [60, 85]);
  const r = await tailorResume(master, "JD", ai);
  assert.equal(ai.calls.tailor, 2);
  assert.equal(r.ats.score, 85);
  assert.equal(r.tailored.summary, better.summary);
});

test("rewrite that scores worse is discarded", async () => {
  const worse = { ...good, summary: "Worse summary that scored lower than the first one." };
  const r = await tailorResume(master, "JD", fakeAi([good, worse], [70, 50]));
  assert.equal(r.ats.score, 70);
  assert.equal(r.tailored.summary, good.summary);
});

test("invalid output retries once, then succeeds", async () => {
  const { tailored } = await tailorResume(master, "JD", fakeAi([{ summary: "x" }, good]));
  assert.equal(tailored.projects.length, 2);
});

test("invented ids fail after retry", async () => {
  const bad = { ...good, projects: [{ id: "p99", bullets: ["x"] }] };
  await assert.rejects(tailorResume(master, "JD", fakeAi([bad, bad])), /Unknown project id: p99/);
});

test("non-job post returns skip", async () => {
  const r = await tailorResume(master, "happy birthday", fakeAi([{ skip: true, reason: "Not a job" }]));
  assert.deepStrictEqual(r, { skip: true, reason: "Not a job" });
});

test("caps projects at 4 and bullets at 4", async () => {
  const many = { ...good, projects: ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => ({ id, bullets: ["a", "b", "c", "d", "e"] })) };
  const { tailored } = await tailorResume(master, "JD", fakeAi([many]));
  assert.equal(tailored.projects.length, 4);
  assert.equal(tailored.projects[0].bullets.length, 4);
});

test("over 2 pages drops last projects until it fits", async () => {
  const heavy = {
    ...good,
    skills: master.skills,
    experience: master.experience.map((e) => ({ id: e.id, bullets: e.bullets.map((b) => b.text) })),
    projects: master.projects.slice(0, 4).map((p) => ({ id: p.id, bullets: p.bullets.slice(0, 4).map((b) => b.text) })),
  };
  const out = await generateResumePdf(master, heavy);
  assert.ok(out.pages <= 2, `got ${out.pages} pages`);
  assert.ok(out.tailored.projects.length >= 2);
});

test("trimJd drops boilerplate, hashtags and links; keeps requirements", () => {
  const { trimJd } = require("./jd");
  const jd = "We're hiring a DevOps Engineer!\nRequirements:\n- 3+ years AWS and Kubernetes\nBenefits:\n- Free lunch\n- Gym\nResponsibilities:\n- Own CI/CD\nApply: https://x.co/apply\nWe are an equal opportunity employer.\n#hiring #devops";
  const out = trimJd(jd);
  assert.match(out, /3\+ years AWS and Kubernetes/);
  assert.match(out, /Own CI\/CD/);
  assert.doesNotMatch(out, /lunch|Gym|https|equal opportunity|#hiring/);
});

test("tailorCached calls AI once for the same JD", async () => {
  const os = require("os"), fs = require("fs"), path = require("path");
  process.env.RESUME_OUTPUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "resume-"));
  delete require.cache[require.resolve("./tailor")];
  const { tailorCached } = require("./tailor");
  const ai = fakeAi([good, good]);
  const jd = "Senior DevOps engineer needed: AWS, EKS, Terraform, GitHub Actions.";
  const a = await tailorCached(master, jd, ai);
  const b = await tailorCached(master, jd + "\n#hiring", ai); // same after trimming
  assert.equal(ai.calls.tailor, 1);
  assert.equal(b.cached, true);
  assert.deepStrictEqual(b.tailored, a.tailored);
  assert.equal((await tailorCached(master, "hi", ai)).skip, true);
});

test("withTailoredResume replaces only the resume/cv file", () => {
  const { withTailoredResume } = require("./index");
  const pdf = Buffer.from("%PDF");
  const files = [
    { name: "Ismail_Abbasi_CV.pdf", url: "https://s/cv.pdf", type: "application/pdf" },
    { name: "Portfolio.pdf", url: "https://s/p.pdf", type: "application/pdf" },
  ];
  const out = withTailoredResume(files, { pdf, filename: "Ismail_Abbasi_Resume.pdf" });
  assert.deepStrictEqual(out.map((a) => a.filename), ["Portfolio.pdf", "Ismail_Abbasi_Resume.pdf"]);
  assert.equal(out[1].content, pdf);
  assert.equal(withTailoredResume(undefined, { pdf, filename: "r.pdf" }).length, 1);
});
