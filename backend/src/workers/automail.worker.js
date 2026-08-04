const pc = require("picocolors");
const nodemailer = require("nodemailer");
const axios = require("axios");
const { decryptPassword } = require("../lib/crypto");
const { ExecutionLogger } = require("../lib/logger");
const { generateAiPersonalizedEmail } = require("../services/ai.service");

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
    
    console.log(pc.dim(`  -> Result: Found ${users ? users.length : 0} users with automail enabled.`));
    if (!users || users.length === 0) return;

    for (const user of users) {
      const userId = user.user_id;
      const email = user.smtp_email;
      const appPassword = user.smtp_password;
      const limit = parseInt(user.daily_mail_limit, 10) || 50;
      const defaultInterval = process.env.AUTOMAIL_WORKER_INTERVAL_SEC ? parseInt(process.env.AUTOMAIL_WORKER_INTERVAL_SEC, 10) : 3;
      const delaySec = user.send_delay_sec || defaultInterval;
      
      const aiProvider = user.ai_provider || "none";
      const aiApiKey = user.ai_api_key;
      const aiPrompt = user.ai_prompt || "You are an expert recruiter. Analyze the POST TEXT. If it's completely irrelevant or doesn't look like a job/hiring post, return {\"skip\": true, \"reason\": \"Irrelevant post\"}. Otherwise, adapt the BASE TEMPLATE to perfectly match the role/requirements described in the POST TEXT. CRITICAL: DO NOT use placeholders like [Name], [Company], etc. If you don't know a piece of information, either infer it from the context or rephrase to omit it. Always sign off with a proper name if available in the template, never use placeholders or generic company names for the sender signature. Output ONLY valid JSON with 'subject' and 'body' keys (or 'skip' and 'reason').";

      if (!email || !appPassword) {
        console.log(pc.yellow(`[Automail] User ${userId.substring(0, 8)} enabled automail but missing SMTP creds. Skipping.`));
        continue;
      }

      // Delay logger creation until we are sure there is work to do


      // 2. Determine how many emails they can send today
      const { count: sentToday, error: countErr } = await supabase
        .from("automailsend_sent_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "sent")
        .gte("sent_at", getStartOfDayUTC());

      if (countErr) {
        console.error(pc.red(`Error fetching sent count for user ${userId}: ${countErr.message}`));
        continue;
      }

      const remainingQuota = limit - (sentToday || 0);
      
      if (remainingQuota <= 0) {
        // Silently skip to prevent log flooding every 3 seconds
        continue;
      }

      // 3. Fetch pending recipients
      const { data: rawPending, error: pendingErr } = await supabase
        .from("automailsend_recipients")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .limit(remainingQuota * 3); // fetch extra to account for duplicates

      if (pendingErr) {
        console.error(pc.red(`Error fetching pending recipients for user ${userId}: ${pendingErr.message}`));
        continue;
      }
      
      const uniquePendingMap = new Map();
      for (const r of (rawPending || [])) {
        if (!r.email) {
           uniquePendingMap.set(`id:${r.id}`, r); // keep ones without email
           continue;
        }
        const key = r.email.toLowerCase();
        if (!uniquePendingMap.has(key)) {
          uniquePendingMap.set(key, r);
        }
      }
      const pending = Array.from(uniquePendingMap.values()).slice(0, remainingQuota);

      if (!pending || pending.length === 0) {
        // Silently skip if no emails to send
        continue;
      }

      // We have work to do, initialize the logger
      const logger = new ExecutionLogger(userId, "automail");
      await logger.start(`Starting Automail batch process...`);
      await logger.append("INFO", `Checking Quota - Limit: ${limit}, Sent Today: ${sentToday || 0}, Remaining: ${remainingQuota}`);

      await logger.append("INFO", `Quota: ${remainingQuota}, Pending: ${pending.length}`);

      // 4. Fetch user templates
      const { data: templates, error: tempErr } = await supabase
        .from("automailsend_templates")
        .select("*")
        .eq("user_id", userId);

      if (tempErr || !templates) {
        await logger.finish("error", `Error fetching templates`);
        continue;
      }

      const templatesByRole = {};
      templates.forEach(t => { templatesByRole[t.role] = t; });

      // 5. Setup Nodemailer
      const config = user.config || {};
      let host = config.host || 'smtp.gmail.com';
      let port = config.port || 465;
      let secure = port === 465;
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
          await logger.finish("error", `Failed to decrypt SMTP password.`);
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
          await logger.append("WARN", `Missing template for role ${recipient.role}. Skipping recipient ${recipient.email}.`);
          continue;
        }

        if (!recipient.email) {
          await logger.append("WARN", `Recipient ${recipient.id} has no email address. Skipping.`);
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
            await logger.append("INFO", `Generating AI personalization for ${recipient.email}...`);
            const aiContent = await generateAiPersonalizedEmail(aiProvider, aiApiKey, aiPrompt, recipient, recipient.context_text, template);
            
            if (aiContent && aiContent.skip) {
              shouldSkip = true;
              skipReason = aiContent.reason || "AI decided to skip based on context.";
              await logger.append("WARN", `AI Skip: ${skipReason}`);
            } else if (aiContent && aiContent.subject && (aiContent.body || aiContent.html)) {
              subject = aiContent.subject;
              text = aiContent.body || aiContent.html;
              await logger.append("SUCCESS", `AI personalization successful!`);
            } else {
              await logger.append("WARN", `AI returned invalid format, falling back to template. Response: ${JSON.stringify(aiContent)}`);
            }
          } catch (aiErr) {
            await logger.append("ERROR", `AI generation failed: ${aiErr.message} - ${aiErr.response?.data ? JSON.stringify(aiErr.response.data) : ''}. Falling back to template.`);
          }
        }

        if (shouldSkip) {
          await supabase.from("automailsend_recipients").update({ status: "failed" }).eq("user_id", userId).eq("email", recipient.email);
          await supabase.from("automailsend_sent_log").insert({
            user_id: userId,
            email: recipient.email,
            role: recipient.role,
            title: recipient.title,
            subject: subject,
            body: text,
            status: "skipped",
            error_message: skipReason,
          });
          continue;
        }

        let status = "failed";
        let errorMsg = null;

        const fromEmail = config.fromEmail || email;
        const fromName = config.fromName;
        
        const mailOptions = {
          from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
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
          await logger.append("SUCCESS", `Sent email to ${recipient.email}`);
        } catch (err) {
          status = "failed";
          errorMsg = err.message;
          await logger.append("ERROR", `Failed to send to ${recipient.email}: ${err.message}`);
        }

        // Update recipient status
        await supabase
          .from("automailsend_recipients")
          .update({ status })
          .eq("user_id", userId)
          .eq("email", recipient.email);

        // Log to sent_log
        await supabase
          .from("automailsend_sent_log")
          .insert({
            user_id: userId,
            email: recipient.email,
            role: recipient.role,
            title: recipient.title,
            subject: subject,
            body: text,
            status,
            error_message: errorMsg,
          });

        if (delaySec > 0) {
          // Anti-ban Jitter: Randomize delay by +/- 20%
          const jitter = Math.random() * 0.4 - 0.2; 
          const actualDelayMs = (delaySec * 1000) * (1 + jitter);
          await logger.append("INFO", `Waiting ${Math.round(actualDelayMs / 1000)}s before next email...`);
          await sleep(actualDelayMs);
        }
      }
      
      await logger.finish("success", `Finished batch. Sent: ${sentCount}`);
    }
  } catch (err) {
    console.error(pc.red("[Automail] Global error: " + err.message));
  }
}

module.exports = { runAutomailJobs };
