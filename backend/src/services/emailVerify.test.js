// Run: node --test src/services/emailVerify.test.js
const test = require("node:test");
const assert = require("node:assert");
const { checkEmail } = require("./emailVerify.service");

test("no Reacher URL or Reacher down never blocks sending", async () => {
  assert.equal((await checkEmail("a@b.com", "")).reachable, "unknown");
  assert.equal((await checkEmail("a@b.com", "http://127.0.0.1:1")).reachable, "unknown");
});
