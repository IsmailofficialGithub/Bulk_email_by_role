const axios = require("axios");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same providers, URLs, env vars and model rules as services/ai.service.js, kept separate so email code stays untouched.
async function callAiJson(provider, apiKey, systemPrompt, userPrompt, maxTokens = 2800) {
  // More patient than ai.service.js: on low per-minute token tiers this call runs right after the email call.
  let retries = 5;
  let delay = 5000;

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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: maxTokens,
          // Reasoning models spend max_tokens on thinking first; keep it short so the JSON fits.
          ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {})
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
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens }
        });
        return JSON.parse(res.data.candidates[0].content.parts[0].text);
      }

      throw new Error(`Unsupported AI Provider: ${provider}`);
    } catch (error) {
      if (error.response && error.response.status === 429 && attempt < retries) {
        const retryAfterMs = (parseFloat(error.response.headers?.["retry-after"]) || 0) * 1000;
        await sleep(Math.max(delay, retryAfterMs + 1000));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
}

module.exports = { callAiJson };
