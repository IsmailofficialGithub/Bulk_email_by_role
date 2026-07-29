const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function collectFromUnknown(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    const matches = value.match(EMAIL_REGEX);
    if (matches) matches.forEach((m) => out.add(m.toLowerCase()));
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
        out.add(nested.trim().toLowerCase());
      } else {
        collectFromUnknown(nested, out);
      }
    }
  }
}

/** Extract unique emails from plain text or JSON. */
export function extractEmails(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const found = new Set<string>();

  try {
    const parsed = JSON.parse(trimmed);
    collectFromUnknown(parsed, found);
  } catch {
    const matches = trimmed.match(EMAIL_REGEX);
    if (matches) matches.forEach((m) => found.add(m.toLowerCase()));
  }

  return Array.from(found);
}
