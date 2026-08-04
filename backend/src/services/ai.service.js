const axios = require("axios");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyPlaceholders(text, recipient) {
  return text
    .replaceAll("{{title}}", recipient.title || "")
    .replaceAll("{{email}}", recipient.email);
}

const SYSTEM_PROMPT = `You are an expert AI email assistant. 
Your output MUST be a valid JSON object. Do not wrap the JSON in markdown code blocks.
If the job post is completely irrelevant or not a job post, return:
{
  "skip": true,
  "reason": "<reason for skipping>"
}
Otherwise, you must return:
{
  "subject": "<email subject>",
  "html": "<the HTML body of the email>"
}`;

async function generateAiPersonalizedEmail(provider, apiKey, promptTemplate, recipient, contextText, baseTemplate) {
  const prompt = applyPlaceholders(promptTemplate, recipient) 
    + "\n\n--- BASE TEMPLATE SUBJECT ---\n" + baseTemplate.subject
    + "\n\n--- BASE TEMPLATE BODY ---\n" + baseTemplate.content
    + "\n\n--- POST TEXT ---\n" + (contextText || "No context provided.")
    + (recipient.source_url ? "\n\n--- SOURCE URL(S) ---\n" + recipient.source_url : "");
  
  let retries = 3;
  let delay = 2000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (provider === "openai" || provider === "groq") {
        const url = provider === "openai" 
          ? (process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions")
          : (process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions");
        const model = provider === "openai" ? "gpt-4o-mini" : "llama-3.1-8b-instant";
        
        const res = await axios.post(url, {
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        }, {
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
        });
        
        return JSON.parse(res.data.choices[0].message.content);
      } else if (provider === "gemini") {
        const baseUrl = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
        const url = `${baseUrl}?key=${apiKey}`;
        const res = await axios.post(url, {
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
        return JSON.parse(res.data.candidates[0].content.parts[0].text);
      }
      
      throw new Error(`Unsupported AI Provider: ${provider}`);
    } catch (error) {
      if (error.response && error.response.status === 429 && attempt < retries) {
        await sleep(delay);
        delay *= 2; // exponential backoff
        continue;
      }
      throw error;
    }
  }
}

module.exports = {
  generateAiPersonalizedEmail
};
