const pc = require("picocolors");
const nodemailer = require("nodemailer");
const axios = require("axios");

async function generateAiPersonalizedEmail(provider, apiKey, promptTemplate, recipient, contextText) {
  const prompt = applyPlaceholders(promptTemplate, recipient) + "\n\n--- POST TEXT ---\n" + (contextText || "No context provided.");
  
  if (provider === "openai" || provider === "groq") {
    const url = provider === "openai" 
      ? "https://api.openai.com/v1/chat/completions" 
      : "https://api.groq.com/openai/v1/chat/completions";
    const model = provider === "openai" ? "gpt-4o-mini" : "llama3-8b-8192";
    
    const res = await axios.post(url, {
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    }, {
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });
    
    return JSON.parse(res.data.choices[0].message.content);
  } else if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    return JSON.parse(res.data.candidates[0].content.parts[0].text);
  }
  
  throw new Error(`Unsupported AI Provider: ${provider}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyPlaceholders(text, recipient) {
  return text
    .replaceAll("{{title}}", recipient.title || "")
    .replaceAll("{{email}}", recipient.email);
}

function getStartOfDayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function runAutomailJobs(supabase) {
  try {
    // 1. Fetch users with Automail enabled
    const { data: users, error: usersErr } = await supabase
      .from("automailsend_app_state")
      .select("*")
      .eq("automail_enabled", true);

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) return;

    for (const user of users) {
      const userId = user.user_id;
      const email = user.smtp_email;
      const appPassword = user.smtp_password;
      const limit = user.daily_mail_limit || 50;
      const delaySec = user.send_delay_sec || 3;
      
      const aiProvider = user.ai_provider || "none";
      const aiApiKey = user.ai_api_key;
      const aiPrompt = user.ai_prompt || "You are an expert recruiter. Analyze the following LinkedIn post text. The author's email is {{email}}. Write a highly personalized, friendly, and concise email subject and body offering our services. Output ONLY valid JSON with 'subject' and 'body' keys.";

      if (!email || !appPassword) {
        console.log(pc.yellow(`[Automail] User ${userId.substring(0, 8)} enabled automail but missing SMTP creds. Skipping.`));
        continue;
      }

      // 2. Determine how many emails they can send today
      const { count: sentToday, error: countErr } = await supabase
        .from("automailsend_sent_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "sent")
        .gte("sent_at", getStartOfDayUTC());

      if (countErr) {
        console.error(pc.red(`[Automail] Error fetching sent count for ${userId}: ${countErr.message}`));
        continue;
      }

      const remainingQuota = limit - (sentToday || 0);
      if (remainingQuota <= 0) {
        continue;
      }

      // 3. Fetch pending recipients
      const { data: pending, error: pendingErr } = await supabase
        .from("automailsend_recipients")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .limit(remainingQuota);

      if (pendingErr) {
        console.error(pc.red(`[Automail] Error fetching pending recipients for ${userId}: ${pendingErr.message}`));
        continue;
      }
      
      if (!pending || pending.length === 0) {
        continue;
      }

      console.log(pc.blue(`[Automail] Starting batch for user ${userId.substring(0, 8)}. Quota: ${remainingQuota}, Pending: ${pending.length}`));

      // 4. Fetch user templates
      const { data: templates, error: tempErr } = await supabase
        .from("automailsend_templates")
        .select("*")
        .eq("user_id", userId);

      if (tempErr || !templates) {
        console.error(pc.red(`[Automail] Error fetching templates for ${userId}`));
        continue;
      }

      const templatesByRole = {};
      templates.forEach(t => { templatesByRole[t.role] = t; });

      // 5. Setup Nodemailer
      let host = 'smtp.gmail.com';
      let port = 465;
      let secure = true;
      if (email.includes('@outlook.com') || email.includes('@hotmail.com')) {
        host = 'smtp-mail.outlook.com';
        port = 587;
        secure = false;
      }
  
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: email,
          pass: appPassword,
        },
      });

      // 6. Send loop
      let sentCount = 0;
      for (const recipient of pending) {
        const template = templatesByRole[recipient.role];
        if (!template || !template.subject || !template.content) {
          console.log(pc.yellow(`[Automail] Missing template for role ${recipient.role} for user ${userId}. Skipping recipient ${recipient.email}.`));
          continue;
        }

        let subject = applyPlaceholders(template.subject, recipient);
        let text = applyPlaceholders(template.content, recipient);

        if (aiProvider !== "none" && aiApiKey) {
          try {
            console.log(pc.cyan(`  [Automail] Generating AI personalization for ${recipient.email}...`));
            const aiContent = await generateAiPersonalizedEmail(aiProvider, aiApiKey, aiPrompt, recipient, recipient.context_text);
            if (aiContent && aiContent.subject && aiContent.body) {
              subject = aiContent.subject;
              text = aiContent.body;
              console.log(pc.green(`  ✔ AI personalization successful!`));
            } else {
              console.log(pc.yellow(`  ⚠️ AI returned invalid format, falling back to template.`));
            }
          } catch (aiErr) {
            console.error(pc.yellow(`  ⚠️ AI generation failed: ${aiErr.message}. Falling back to template.`));
          }
        }

        let status = "failed";
        let errorMsg = null;

        try {
          await transporter.sendMail({
            from: email,
            to: recipient.email,
            subject,
            text,
          });
          status = "sent";
          sentCount++;
          console.log(pc.green(`  ✔ Sent email to ${recipient.email}`));
        } catch (err) {
          status = "failed";
          errorMsg = err.message;
          console.error(pc.red(`  ✖ Failed to send to ${recipient.email}: ${err.message}`));
        }

        // Update recipient status
        await supabase
          .from("automailsend_recipients")
          .update({ status })
          .eq("id", recipient.id);

        // Log to sent_log
        await supabase
          .from("automailsend_sent_log")
          .insert({
            user_id: userId,
            email: recipient.email,
            role: recipient.role,
            title: recipient.title,
            status,
            error_message: errorMsg,
          });

        if (delaySec > 0) {
          await sleep(delaySec * 1000);
        }
      }
      
      console.log(pc.cyan(`[Automail] Finished batch for ${userId.substring(0, 8)}. Sent: ${sentCount}`));
    }
  } catch (err) {
    console.error(pc.red("[Automail] Global error: " + err.message));
  }
}

module.exports = { runAutomailJobs };
