const pc = require("picocolors");
const nodemailer = require("nodemailer");
const axios = require("axios");
const { decryptPassword } = require("../lib/crypto");

async function generateAiPersonalizedEmail(provider, apiKey, promptTemplate, recipient, contextText, baseTemplate) {
  const prompt = applyPlaceholders(promptTemplate, recipient) 
    + "\n\n--- BASE TEMPLATE SUBJECT ---\n" + baseTemplate.subject
    + "\n\n--- BASE TEMPLATE BODY ---\n" + baseTemplate.content
    + "\n\n--- POST TEXT ---\n" + (contextText || "No context provided.");
  
  if (provider === "openai" || provider === "groq") {
    const url = provider === "openai" 
      ? (process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions")
      : (process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions");
    const model = provider === "openai" ? "gpt-4o-mini" : "llama-3.1-8b-instant";
    
    const res = await axios.post(url, {
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    }, {
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });
    
    return JSON.parse(res.data.choices[0].message.content);
  } else if (provider === "gemini") {
    const baseUrl = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const url = `${baseUrl}?key=${apiKey}`;
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
      const defaultInterval = process.env.AUTOMAIL_WORKER_INTERVAL_SEC ? parseInt(process.env.AUTOMAIL_WORKER_INTERVAL_SEC, 10) : 3;
      const delaySec = user.send_delay_sec || defaultInterval;
      
      const aiProvider = user.ai_provider || "none";
      const aiApiKey = user.ai_api_key;
      const aiPrompt = user.ai_prompt || "You are an expert recruiter. Analyze the POST TEXT. If it's completely irrelevant or doesn't look like a job/hiring post, return {\"skip\": true, \"reason\": \"Irrelevant post\"}. Otherwise, adapt the BASE TEMPLATE to perfectly match the role/requirements described in the POST TEXT (e.g. changing 'DevOps' to the role they are hiring for). Output ONLY valid JSON with 'subject' and 'body' keys (or 'skip' and 'reason').";

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
  
      let passwordToUse = appPassword;
      if (passwordToUse.startsWith("enc:")) {
        try {
          passwordToUse = decryptPassword(passwordToUse);
        } catch (err) {
          console.error(pc.red(`[Automail] Failed to decrypt password for ${userId}. Skipping.`));
          continue;
        }
      }
      passwordToUse = passwordToUse.replace(/\s+/g, "");

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: email,
          pass: passwordToUse,
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

        if (!recipient.email) {
          console.log(pc.yellow(`[Automail] Recipient ${recipient.id} has no email address. Skipping.`));
          await supabase.from("automailsend_recipients").update({ status: "failed" }).eq("id", recipient.id);
          await supabase.from("automailsend_sent_log").insert({
            user_id: userId,
            email: recipient.phone || "No Email",
            role: recipient.role,
            title: recipient.title,
            status: "failed",
            error_message: "No email address found",
          });
          continue;
        }

        let subject = applyPlaceholders(template.subject, recipient);
        let text = applyPlaceholders(template.content, recipient);
        let shouldSkip = false;
        let skipReason = null;

        if (aiProvider !== "none" && aiApiKey) {
          try {
            console.log(pc.cyan(`  [Automail] Generating AI personalization for ${recipient.email}...`));
            const aiContent = await generateAiPersonalizedEmail(aiProvider, aiApiKey, aiPrompt, recipient, recipient.context_text, template);
            
            if (aiContent && aiContent.skip) {
              shouldSkip = true;
              skipReason = aiContent.reason || "AI decided to skip based on context.";
              console.log(pc.yellow(`  ⚠️ AI Skip: ${skipReason}`));
            } else if (aiContent && aiContent.subject && aiContent.body) {
              subject = aiContent.subject;
              text = aiContent.body;
              console.log(pc.green(`  ✔ AI personalization successful!`));
            } else {
              console.log(pc.yellow(`  ⚠️ AI returned invalid format, falling back to template.`));
            }
          } catch (aiErr) {
            console.error(pc.yellow(`  ⚠️ AI generation failed: ${aiErr.message}. Falling back to template.`));
            if (aiErr.response && aiErr.response.data) {
              console.error(pc.yellow(`  ⚠️ AI Error details: ${JSON.stringify(aiErr.response.data)}`));
            }
          }
        }

        if (shouldSkip) {
          await supabase.from("automailsend_recipients").update({ status: "failed" }).eq("id", recipient.id);
          await supabase.from("automailsend_sent_log").insert({
            user_id: userId,
            email: recipient.email,
            role: recipient.role,
            title: recipient.title,
            status: "skipped",
            error_message: skipReason,
          });
          continue;
        }

        let status = "failed";
        let errorMsg = null;

        const mailOptions = {
          from: email,
          to: recipient.email,
          subject,
          text,
        };

        if (template.files && template.files.length > 0) {
          mailOptions.attachments = template.files.map(a => ({
            filename: a.name,
            href: a.url,
            contentType: a.type,
          }));
        }

        try {
          await transporter.sendMail(mailOptions);
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
