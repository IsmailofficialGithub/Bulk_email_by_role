# Custom Resume Generator: Build Plan

## Core idea

The AI only returns a small JSON. Your code does everything else (layout, PDF).

**Flow:** master resume JSON + job description → AI → tailored JSON → validate → HTML template → PDF

## How it works

&#91;embedded content: build flow · 7 steps, 1 retry loop\]

Seven steps run top to bottom. Only step 4 calls an AI; everything else is plain code.

## What stays fixed and what gets tailored

Your master data is the source of truth. The AI only picks and rewrites text, never names, links or dates.

| Field | Behavior | Example |
| --- | --- | --- |
| Project name, link | Fixed, from your master data | AI Voice Agent and its URL |
| Company, job title, dates | Fixed | Same on every resume |
| Project description | Rewritten by AI per job | Same project, different emphasis |
| Tech tags | AI picks from the tags you listed | Subset of your own list |
| Bullets | AI picks by ID, rewrites only if needed | p1b1, p1b3 |
| Summary, skill order | Written or ranked by AI | Short, matched to the JD |

## Data format

You store the master resume once. Every project, bullet and skill has an ID.

```json
{
  "profile": { "name": "", "email": "", "phone": "", "links": [] },
  "projects": [
    { "id": "p1", "name": "AI Voice Agent", "link": "https://...",
      "description": "default text", "tags": ["Node", "WebSockets"],
      "bullets": [{ "id": "p1b1", "text": "..." }] }
  ],
  "experience": [
    { "id": "e1", "company": "", "title": "", "dates": "",
      "bullets": [{ "id": "e1b1", "text": "..." }] }
  ],
  "skills": [{ "id": "s1", "name": "TypeScript" }]
}
```

The AI returns only the JSON below. Code looks up names, links and dates by ID, and Zod rejects any ID that does not exist.

```json
{
  "summary": "2 sentences matched to the JD",
  "projects": [
    { "id": "p1", "description": "tailored text",
      "tags": ["Node", "WebSockets"], "bulletIds": ["p1b1", "p1b3"] }
  ],
  "experience": [{ "id": "e1", "bulletIds": ["e1b2", "e1b1"] }],
  "skillIds": ["s3", "s1"],
  "keywords": ["voice AI", "WebSockets"]
}
```

The prompt sent to the AI is three parts: your master JSON, the trimmed JD, and this output format.

## Stack

- **Language/API:** TypeScript with NestJS (or Next.js API routes if you want one repo)
- **AI layer:** one `generateJSON(prompt)` function with an adapter per provider (OpenAI, Grok, DeepSeek, or a free API). Switch with an env var. DeepSeek and xAI expose OpenAI-compatible APIs, so one client with a different base URL and key can cover them
- **Validation:** Zod always. Use the provider's JSON mode or structured output where it exists, but never trust it alone. Retry once on failure
- **Template:** Handlebars or React, rendered to HTML with CSS
- **PDF:** Playwright `page.pdf()`. It gives selectable text, which ATS systems need. Alternative: Typst for faster, cleaner output
- **Delivery:** return the PDF bytes straight from the endpoint, no storage needed
- **Optional storage and DB:** Supabase (Storage for PDFs, Postgres for history), or a server folder zipped on demand
- **Frontend:** a simple page with a JD box and a download button

## Cutting token usage

1. **Store your resume once as structured JSON** with an ID on every bullet and skill. Never send raw resume text or a PDF.
2. **AI returns selections, not rewrites:** which bullet IDs to include, their order, tailored project descriptions and tags, and a short summary. Only rewrite a bullet when truly needed.
3. **Put the stable part first in the prompt:** master JSON and output format first, the JD last. Several providers (OpenAI, DeepSeek) cache repeated prompt prefixes automatically at a lower price; check your provider's docs for the exact rules.
4. **Use the cheapest model that returns valid JSON reliably.** Selection and ranking don't need a flagship model.
5. **Trim the JD first** with plain code: strip boilerplate like benefits and legal text, keep responsibilities and requirements.
6. **Cap output:** set `max_tokens` low and use short field names in the schema.
7. **Cache results** by hash of the JD so the same job never costs twice.

## Delivery and storage

The API returns the PDF bytes in the response, so nothing has to be stored. Add storage only if you want history.

- **Return only:** generate, send to the browser, discard. No storage cost.
- **Supabase Storage:** upload the PDF and keep a link per job.
- **Server zip:** write PDFs to a folder and zip on demand.

Put storage behind one `savePdf(bytes)` function so you can swap it later.

## Build order

1. Define the master resume JSON and the AI output format (see Data format).
2. Build the HTML template and PDF generator using hardcoded JSON. Get this looking right first.
3. Add the AI adapter with Zod validation. Test with one provider, then add the others.
4. Add JD trimming and the cache.
5. Return the PDF from the endpoint, then add the optional storage function.
6. Add a simple UI.
7. Later: multiple templates, a cover letter from the same pipeline, and an ATS keyword-match score computed in code, not by AI.

## Key point

AI never touches layout. That keeps it cheap, fast, and predictable.

## Decisions (grilled 2026-10-28) — these override the sections above

| # | Decision |
|---|---|
| 1 | Branch `feature/resume-generator`; nothing merges to `master` until tested and approved by me |
| 2 | Code in `backend/src/resume/`; one route line in `backend/src/index.js` |
| 3 | Express + plain JS (CommonJS), not NestJS/TS; Zod validates AI output |
| 4 | Single user (me), one master resume |
| 5 | JD = scraped post (`recipient.context_text`) inside `backend/src/workers/automail.worker.js` |
| 6 | `RESUME_TAILOR=on` env flag, off by default; on any failure send the normal resume; log every outcome |
| 7 | Test via `POST /api/resume/preview` (JD text or recipient ID) → PDF, no email sent |
| 8 | Separate AI call; existing email prompt/parsing untouched |
| 9 | Same AI provider/key as email personalization (reuse `backend/src/services/ai.service.js`, import only) |
| 10 | Master JSON converted once from my current resume, then hand-checked |
| 11 | Stored at `backend/src/resume/master.json`, gitignored (contains contact info) |
| 12 | PDF via Playwright from an HTML template |
| 13 | Strict 1 page, same design as my current resume; caps + page-count check in code |
| 14 | Generated PDFs saved to a server folder |
| 15 | Tailored PDF replaces the template attachment named like resume/cv; other attachments kept |

Defaults: AI skip → no resume (same as email today). Filename `<Name>_Resume.pdf`.
