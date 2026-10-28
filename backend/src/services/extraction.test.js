// Run: node --test src/services/extraction.test.js
const test = require("node:test");
const assert = require("node:assert");
const { extractInitialContacts } = require("./extraction.service");

test("each email gets the text of its own post, not the page start", () => {
  const raw = `<!DOCTYPE html><html><head><script>junk junk</script></head><body>${"<div>Unrelated post about cooking pasta at home tonight</div>".repeat(5)}`
    + `<p>We are hiring a Senior Node.js Developer, remote US.<br/>Send your CV to jobs@acme.io with your portfolio.</p></body></html>`;
  const { contextByContact } = extractInitialContacts(raw);
  assert.match(contextByContact["jobs@acme.io"], /hiring a Senior Node\.js Developer/);
  assert.doesNotMatch(contextByContact["jobs@acme.io"], /DOCTYPE|<script>/);
});
