const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const EMAIL_ONLY =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function collectFromUnknown(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    collectFromText(value, out);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectFromUnknown(item, out));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (
        key.toLowerCase().includes("email") &&
        typeof nested === "string" &&
        nested.includes("@")
      ) {
        collectFromText(nested, out);
      } else {
        collectFromUnknown(nested, out);
      }
    }
  }
}

/** Pull emails from text split by comma, semicolon, space, or newline. */
function collectFromText(text: string, out: Set<string>): void {
  const parts = text.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const cleaned = part.replace(/^[\s<"'(]+|[>"'),;]+$/g, "");
    if (EMAIL_ONLY.test(cleaned)) {
      out.add(cleaned.toLowerCase());
    }
  }

  const matches = text.match(EMAIL_REGEX);
  if (matches) matches.forEach((m) => out.add(m.toLowerCase()));
}

/** Extract unique emails from JSON, comma/space lists, or plain text. */
export function extractEmails(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const found = new Set<string>();

  try {
    const parsed = JSON.parse(trimmed);
    collectFromUnknown(parsed, found);
  } catch {
    collectFromText(trimmed, found);
  }

  return Array.from(found);
}
