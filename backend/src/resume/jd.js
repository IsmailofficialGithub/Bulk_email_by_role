const MAX_CHARS = 6000;

const DROP_HEADING = /benefit|perk|what we offer|why (join|work)|about (us|the company|the team)|who we are|our (culture|values|mission)|equal opportunit|\beeo\b|diversity|how to apply|compensation|salary|disclaimer|privacy/i;
const DROP_LINE = /equal opportunity employer|reasonable accommodation|regardless of (race|gender)|^\s*(#\w+\s*)+$/i;

function isHeading(line) {
  const t = line.trim();
  return t.length > 0 && t.length < 60 && (/:$/.test(t) || /^#+\s/.test(t) || /^\*\*.+\*\*$/.test(t) || (t === t.toUpperCase() && /[A-Z]/.test(t)));
}

// Keep responsibilities/requirements; drop boilerplate sections, hashtags, links and extra whitespace.
function trimJd(text) {
  let skipping = false;
  const kept = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (isHeading(line)) skipping = DROP_HEADING.test(line);
    if (skipping || DROP_LINE.test(line)) continue;
    const clean = line.replace(/https?:\/\/\S+/g, "").replace(/#\w+/g, "").replace(/\s+/g, " ").trim();
    if (clean) kept.push(clean);
  }
  return kept.join("\n").slice(0, MAX_CHARS);
}

module.exports = { trimJd };
