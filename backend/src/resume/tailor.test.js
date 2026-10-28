// Run: node --test src/resume/tailor.test.js
const test = require("node:test");
const assert = require("node:assert");
const master = require("./master.json");
const { tailorResume } = require("./tailor");
const { generateResumePdf } = require("./render");

const good = {
  summary: "Backend and DevOps engineer focused on AWS, Kubernetes and Node.js production systems.",
  projects: [
    { id: "p3", description: "Streaming infra on EKS.", tags: ["EKS", "Made-up"], bulletIds: ["p3b4", "p3b1", "p3b4"] },
    { id: "p6", bulletIds: ["p6b1", "p6b2"] },
  ],
  experience: [{ id: "e1", bulletIds: ["e1b3", "e1b1"] }],
  skillIds: ["s5", "s6"],
};
const fakeAi = (...answers) => async () => answers.shift();

test("valid output passes, dedupes bullet ids", async () => {
  const { tailored } = await tailorResume(master, "DevOps JD", fakeAi(good));
  assert.deepStrictEqual(tailored.projects[0].bulletIds, ["p3b4", "p3b1"]);
});

test("invalid output retries once, then succeeds", async () => {
  const { tailored } = await tailorResume(master, "JD", fakeAi({ summary: "x" }, good));
  assert.equal(tailored.projects.length, 2);
});

test("invented ids fail after retry", async () => {
  const bad = { ...good, projects: [{ id: "p99", bulletIds: ["p99b1"] }] };
  await assert.rejects(tailorResume(master, "JD", fakeAi(bad, bad)), /Unknown project id: p99/);
});

test("non-job post returns skip", async () => {
  const r = await tailorResume(master, "happy birthday", fakeAi({ skip: true, reason: "Not a job" }));
  assert.deepStrictEqual(r, { skip: true, reason: "Not a job" });
});

test("caps projects at 4", async () => {
  const many = { ...good, projects: ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => ({ id, bulletIds: [`${id}b1`] })) };
  const { tailored } = await tailorResume(master, "JD", fakeAi(many));
  assert.equal(tailored.projects.length, 4);
});

test("over 2 pages drops last projects until it fits", async () => {
  const heavy = {
    ...good,
    skillIds: master.skills.map((s) => s.id),
    experience: master.experience.map((e) => ({ id: e.id, bulletIds: e.bullets.map((b) => b.id) })),
    projects: master.projects.slice(0, 4).map((p) => ({ id: p.id, bulletIds: p.bullets.slice(0, 4).map((b) => b.id) })),
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
  let calls = 0;
  const ai = async () => { calls++; return good; };
  const jd = "Senior DevOps engineer needed: AWS, EKS, Terraform, GitHub Actions.";
  const a = await tailorCached(master, jd, ai);
  const b = await tailorCached(master, jd + "\n#hiring", ai); // same after trimming
  assert.equal(calls, 1);
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
