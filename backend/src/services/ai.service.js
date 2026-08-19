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

const COMMENT_SYSTEM_PROMPT = `You are an expert professional on LinkedIn.
Your output MUST be a valid JSON object. Do not wrap the JSON in markdown code blocks.
If the post is completely irrelevant, offensive, or inappropriate to comment on, return:
{
  "skip": true,
  "reason": "<reason for skipping>"
}
Otherwise, you must return:
{
  "comment": "<your concise, highly professional comment>"
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
      if (provider.startsWith("openai") || provider.startsWith("groq")) {
        const isGroq = provider.startsWith("groq");
        const url = isGroq 
          ? (process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions")
          : (process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions");
        
        let model = isGroq ? "llama3-8b-8192" : "gpt-4o-mini";
        if (provider.includes(":")) {
          model = provider.split(":")[1];
          if (model === "llama-3.1-8b-instant" || model === "llama3-8b-8192" || model === "mixtral-8x7b-32768" || model === "gemma2-9b-it" || model === "llama-3.3-70b-versatile") {
            model = "openai/gpt-oss-120b";
          }
        }
        
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
      } else if (provider.startsWith("gemini")) {
        let model = "gemini-1.5-flash";
        if (provider.includes(":")) {
          model = provider.split(":")[1];
        }
        const baseUrl = process.env.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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

async function generateAiComment(provider, apiKey, promptTemplate, contextText) {
  let prompt = promptTemplate;
  if (promptTemplate.includes("{{post_text}}")) {
    prompt = promptTemplate.replaceAll("{{post_text}}", contextText || "No context provided.");
  } else {
    prompt = promptTemplate + "\n\n--- POST TEXT ---\n" + (contextText || "No context provided.");
  }
  
  let retries = 3;
  let delay = 2000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (provider.startsWith("openai") || provider.startsWith("groq")) {
        const isGroq = provider.startsWith("groq");
        const url = isGroq 
          ? (process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions")
          : (process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions");
        
        let model = isGroq ? "llama3-8b-8192" : "gpt-4o-mini";
        if (provider.includes(":")) {
          model = provider.split(":")[1];
          if (model === "llama-3.1-8b-instant" || model === "llama3-8b-8192" || model === "mixtral-8x7b-32768" || model === "gemma2-9b-it" || model === "llama-3.3-70b-versatile") {
            model = "openai/gpt-oss-120b";
          }
        }
        
        const res = await axios.post(url, {
          model,
          messages: [
            { role: "system", content: COMMENT_SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        }, {
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
        });
        
        return JSON.parse(res.data.choices[0].message.content);
      } else if (provider.startsWith("gemini")) {
        let model = "gemini-1.5-flash";
        if (provider.includes(":")) {
          model = provider.split(":")[1];
        }
        const baseUrl = process.env.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const url = `${baseUrl}?key=${apiKey}`;
        const res = await axios.post(url, {
          system_instruction: { parts: [{ text: COMMENT_SYSTEM_PROMPT }] },
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
  generateAiPersonalizedEmail,
  generateAiComment
};
