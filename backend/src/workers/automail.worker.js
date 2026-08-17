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

/** Cap delay so a huge "seconds between emails" value cannot reduce a 50/day quota to 1–3 sends. */
const MAX_AUTOMAIL_DELAY_SEC = 180;

function resolveDelaySec(user) {
  const envDefault = process.env.AUTOMAIL_WORKER_INTERVAL_SEC
    ? parseInt(process.env.AUTOMAIL_WORKER_INTERVAL_SEC, 10)
    : 10;
  const raw = Number(user.send_delay_sec);
  const delay = Number.isFinite(raw) && raw >= 0 ? raw : envDefault;
  return Math.min(delay, MAX_AUTOMAIL_DELAY_SEC);
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
      const delaySec = resolveDelaySec(user);
      
      const aiProvider = user.ai_provider || "none";
      const aiApiKey = user.ai_api_key;
      const aiPrompt = user.ai_prompt || "You are an expert recruiter. Analyze the POST TEXT. If it's completely irrelevant or doesn't look like a job/hiring post, return {\"skip\": true, \"reason\": \"Irrelevant post\"}. Otherwise, adapt the BASE TEMPLATE to perfectly match the role/requirements described in the POST TEXT. CRITICAL: DO NOT use placeholders like [Name], [Company], etc. If you don't know a piece of information, either infer it from the context or rephrase to omit it. Always sign off with a proper name if available in the template, never use placeholders or generic company names for the sender signature. Output ONLY valid JSON with 'subject' and 'body' keys (or 'skip' and 'reason').";

      if (user.is_blocked) {
        console.log(pc.red(`[Automail] User ${userId} is blocked by admin. Skipping.`));
        continue;
      }

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
        console.error(pc.red(`Error fetching sent count for user ${userId}: ${countErr.message}`));
        continue;
      }

      const remainingQuota = limit - (sentToday || 0);
      
      if (remainingQuota <= 0) {
        continue;
      }

      // Pace by last successful send instead of sleeping for hours inside one locked run
      const { data: lastSentRow } = await supabase
        .from("automailsend_sent_log")
        .select("sent_at")
        .eq("user_id", userId)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSentRow?.sent_at && delaySec > 0) {
        const elapsedSec = (Date.now() - new Date(lastSentRow.sent_at).getTime()) / 1000;
        if (elapsedSec < delaySec) {
          continue;
        }
      }

      // 3. Fetch templates first so we only pull pending contacts we can actually send
      const { data: templates, error: tempErr } = await supabase
        .from("automailsend_templates")
        .select("*")
        .eq("user_id", userId);

      if (tempErr || !templates) {
        console.error(pc.red(`Error fetching templates for user ${userId}`));
        continue;
      }

      const templatesByRole = {};
      templates.forEach(t => { templatesByRole[t.role] = t; });
      const sendableRoles = templates
        .filter((t) => t.subject && t.content)
        .map((t) => t.role);

      if (sendableRoles.length === 0) {
        continue;
      }

      const { data: rawPending, error: pendingErr } = await supabase
        .from("automailsend_recipients")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .in("role", sendableRoles)
        .order("id", { ascending: true })
        .limit(Math.max(remainingQuota * 3, 50));

      if (pendingErr) {
        console.error(pc.red(`Error fetching pending recipients for user ${userId}: ${pendingErr.message}`));
        continue;
      }
      
      const uniquePendingMap = new Map();
      for (const r of (rawPending || [])) {
        if (!r.email) continue;
        const key = r.email.toLowerCase();
        if (!uniquePendingMap.has(key)) {
          uniquePendingMap.set(key, r);
        }
      }
      // One email per scheduler tick so the lock is not held for hours and quota can fill over the day
      const pending = Array.from(uniquePendingMap.values()).slice(0, 10);

      if (!pending || pending.length === 0) {
        continue;
      }

      const logger = new ExecutionLogger(userId, "automail");
      await logger.start(`Starting Automail batch process...`);
      await logger.append("INFO", `Checking Quota - Limit: ${limit}, Sent Today: ${sentToday || 0}, Remaining: ${remainingQuota}`);
      await logger.append("INFO", `Sending up to 1 email this tick (delay ${delaySec}s). Remaining quota: ${remainingQuota}.`);

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
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000,
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
        
        const isHtmlBlock = /<html|<body|<!DOCTYPE|<style|<div|<p|<table|<ul|<ol|<li|<h[1-6]|<br|<hr|<blockquote/i.test(text);
        
        let finalHtml = "";
        let finalText = "";

        if (isHtmlBlock) {
          finalHtml = text;
        } else {
          finalHtml = text.replace(/\n/g, "<br>");
        }

        const hasAnyTags = /<[a-z][\s\S]*>/i.test(text) || text.includes("<!DOCTYPE");
        if (hasAnyTags) {
          finalText = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                          .replace(/<br[^>]*>/gi, '\n')
                          .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
                          .replace(/<[^>]+>/g, '')
                          .replace(/\n\s*\n/g, '\n\n')
                          .trim();
        } else {
          finalText = text;
        }

        const mailOptions = {
          from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
          to: recipient.email,
          subject,
          text: finalText,
          html: finalHtml,
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
            sent_at: new Date().toISOString(),
          });

        // One SMTP send per tick; delay is enforced on the next tick via last-sent timestamp
        break;
      }
      
      await logger.finish("success", `Finished batch. Sent: ${sentCount}`);
    }
  } catch (err) {
    console.error(pc.red("[Automail] Global error: " + err.message));
  }
}

module.exports = { runAutomailJobs };
