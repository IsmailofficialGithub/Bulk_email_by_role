const pc = require("picocolors");
const nodemailer = require("nodemailer");
const { supabase } = require("../config/supabase");
const { decryptPassword } = require("../lib/crypto");
const { generateAiPersonalizedEmail } = require("../services/ai.service");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStartOfDayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function applyPlaceholders(text, recipient) {
  return text
    .replaceAll("{{title}}", recipient.title || "")
    .replaceAll("{{email}}", recipient.email);
}

async function processBatchSendJob(job) {
  const { user_id } = job.data;
  console.log(pc.blue(`[BatchSend Worker] Starting batch send for user ${user_id}`));

  try {
    // 1. Fetch user config and templates
    const { data: userState, error: userErr } = await supabase
      .from("automailsend_app_state")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (userErr || !userState) throw new Error("Could not fetch user state");

    if (userState.is_blocked) {
      console.log(pc.red(`[BatchSend] User ${user_id} is blocked by admin. Halting.`));
      return;
    }

    const config = userState.config || {};
    const defaultInterval = process.env.BATCH_INTERVAL_SEC ? parseInt(process.env.BATCH_INTERVAL_SEC, 10) : 3;
    const delaySec = userState.send_delay_sec !== undefined && userState.send_delay_sec !== null
      ? Number(userState.send_delay_sec)
      : defaultInterval;

    const emailToUse = config.email || userState.smtp_email;
    const rawAppPassword = config.appPassword || userState.smtp_password;

    if (!emailToUse || !rawAppPassword) {
      throw new Error("SMTP config missing");
    }

    let decryptedPassword = rawAppPassword;
    if (decryptedPassword.startsWith("enc:")) {
      try {
        decryptedPassword = decryptPassword(decryptedPassword);
      } catch {
        throw new Error("Failed to decrypt app password");
      }
    }
    decryptedPassword = decryptedPassword.replace(/\s+/g, "");

    const { data: templatesArray } = await supabase
      .from("automailsend_templates")
      .select("*")
      .eq("user_id", user_id);
    
    if (!templatesArray || templatesArray.length === 0) {
      console.log(pc.yellow(`[BatchSend] No templates found for ${user_id}`));
      return;
    }

    const templates = {};
    const validTemplates = templatesArray.filter((t) => t.subject && t.content);
    validTemplates.forEach(t => {
      templates[t.role.toLowerCase()] = t;
    });

    const activeRole = (userState.active_template_role || "fullstack").toLowerCase();
    const defaultTemplate = templates[activeRole] || validTemplates[0];

    // 2. Fetch sent logs to filter out what has already been sent
    const { data: sentLog } = await supabase
      .from("automailsend_sent_log")
      .select("email, role")
      .eq("user_id", user_id)
      .in("status", ["sent", "skipped"]);
    
    const sentKeys = new Set((sentLog || []).map(s => `${s.email}::${s.role}`));

    // 3. Check Daily Quota
    const dailyLimit = userState.daily_mail_limit || 50;
    const { count: sentToday, error: countErr } = await supabase
      .from("automailsend_sent_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("status", "sent")
      .gte("sent_at", getStartOfDayUTC());

    if (countErr) {
      console.error(pc.red(`[BatchSend] Error fetching sent count for ${user_id}: ${countErr.message}`));
      return;
    }

    const remainingQuota = dailyLimit - (sentToday || 0);
    if (remainingQuota <= 0) {
      console.log(pc.yellow(`[BatchSend] User ${user_id} reached daily limit of ${dailyLimit}. Skipping batch send.`));
      return;
    }

    // 4. Fetch pending recipients
    const { data: recipients } = await supabase
      .from("automailsend_recipients")
      .select("*")
      .eq("user_id", user_id)
      .neq("email", "")
      .not("email", "is", null);

    const uniqueMap = new Map();
    for (const r of (recipients || [])) {
      if (!r.email || !r.email.trim()) continue;
      // If target IDs are specified, ignore others
      if (config.batchTargetIds && Array.isArray(config.batchTargetIds) && config.batchTargetIds.length > 0) {
        if (!config.batchTargetIds.includes(r.id)) continue;
      }
      
      const key = `${r.email.toLowerCase().trim()}::${r.role}`;
      if (!sentKeys.has(key) && !uniqueMap.has(key)) {
        uniqueMap.set(key, r);
      }
    }
    
    let toProcess = Array.from(uniqueMap.values());
    
    // Apply quota limit
    toProcess = toProcess.slice(0, remainingQuota);

    if (toProcess.length === 0) {
      console.log(pc.green(`[BatchSend] No new emails to send for ${user_id} (or quota reached)`));
      return;
    }

    // 5. Setup Transporter
    let host = config.host || "smtp.gmail.com";
    let port = config.port || 465;
    let secure = port === 465;
    if (emailToUse.includes('@outlook.com') || emailToUse.includes('@hotmail.com')) {
      host = 'smtp-mail.outlook.com';
      port = 587;
      secure = false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: emailToUse,
        pass: decryptedPassword,
      },
    });

    const delayMs = delaySec * 1000;

    // 6. Send loop
    for (let i = 0; i < toProcess.length; i++) {
      // Check cancellation flag in DB
      const { data: checkState } = await supabase
        .from("automailsend_app_state")
        .select("batch_send_pending")
        .eq("user_id", user_id)
        .single();

      if (!checkState || !checkState.batch_send_pending) {
        console.log(pc.yellow(`[BatchSend] User ${user_id} cancelled the batch processing.`));
        break;
      }

      const recipient = toProcess[i];
      const recipRole = (recipient.role || "").toLowerCase();
      const tpl = templates[recipRole] || defaultTemplate;
      if (!tpl) continue;

      let subject = applyPlaceholders(tpl.subject, recipient);
      let content = applyPlaceholders(tpl.content, recipient);
      
      if (config.batchMode === "ai" && userState.ai_provider && userState.ai_api_key && userState.ai_provider !== "none") {
        try {
          const aiContent = await generateAiPersonalizedEmail(userState.ai_provider, userState.ai_api_key, userState.ai_prompt, recipient, recipient.context_text, tpl);
          if (aiContent && aiContent.skip) {
            console.log(pc.yellow(`[BatchSend] AI skipped ${recipient.email}: ${aiContent.reason}`));
            await supabase.from("automailsend_sent_log").insert({
              user_id, email: recipient.email.toLowerCase(), role: recipient.role, title: recipient.title,
              subject: subject, body: content, status: "skipped", error_message: aiContent.reason, sent_at: new Date().toISOString()
            });
            continue;
          } else if (aiContent && aiContent.subject && (aiContent.body || aiContent.html)) {
            subject = aiContent.subject;
            content = aiContent.body || aiContent.html;
          } else {
            console.log(pc.yellow(`[BatchSend] AI returned invalid format for ${recipient.email}. Response: ${JSON.stringify(aiContent)}`));
          }
        } catch (err) {
          console.error(pc.red(`[BatchSend] AI generation failed for ${recipient.email}: ${err.message} - ${err.response?.data ? JSON.stringify(err.response.data) : ''}`));
        }
      }

      const fromEmail = config.fromEmail || config.email;
      const fromName = config.fromName;

      try {
        const isHtmlBlock = /<html|<body|<!DOCTYPE|<style|<div|<p|<table|<ul|<ol|<li|<h[1-6]|<br|<hr|<blockquote/i.test(content);
        
        let finalHtml = "";
        let finalText = "";

        if (isHtmlBlock) {
          finalHtml = content;
        } else {
          finalHtml = content.replace(/\n/g, "<br>");
        }

        const hasAnyTags = /<[a-z][\s\S]*>/i.test(content) || content.includes("<!DOCTYPE");
        if (hasAnyTags) {
          finalText = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                             .replace(/<br[^>]*>/gi, '\n')
                             .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
                             .replace(/<[^>]+>/g, '')
                             .replace(/\n\s*\n/g, '\n\n')
                             .trim();
        } else {
          finalText = content;
        }

        await transporter.sendMail({
          from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
          to: recipient.email,
          subject,
          text: finalText,
          html: finalHtml,
          attachments: (tpl.files || []).map(a => ({
            filename: a.name,
            path: a.url,
            contentType: a.type
          }))
        });

        // Log success
        await supabase.from("automailsend_sent_log").insert({
          user_id,
          email: recipient.email.toLowerCase(),
          role: recipient.role,
          title: recipient.title,
          subject: subject,
          body: content,
          status: "sent",
          sent_at: new Date().toISOString()
        });
        
        await supabase.from("automailsend_recipients")
          .update({ status: "sent" })
          .eq("user_id", user_id)
          .eq("email", recipient.email);

      } catch (error) {
        const errMessage = error instanceof Error ? error.message : "Send failed";
        // Log failure
        await supabase.from("automailsend_sent_log").insert({
          user_id,
          email: recipient.email.toLowerCase(),
          role: recipient.role,
          title: recipient.title,
          subject: subject,
          body: content,
          status: "failed",
          error_message: errMessage,
          sent_at: new Date().toISOString()
        });
        
        await supabase.from("automailsend_recipients")
          .update({ status: "failed" })
          .eq("user_id", user_id)
          .eq("email", recipient.email);
      }

      if (i < toProcess.length - 1) {
        // Double check cancellation during delay
        let slept = 0;
        const interval = 1000;
        let cancelled = false;

        // Anti-ban Jitter: Randomize delay by +/- 20% to avoid exact, predictable intervals
        const jitter = Math.random() * 0.4 - 0.2; 
        const actualDelayMs = delayMs > 0 ? delayMs * (1 + jitter) : 0;

        while (slept < actualDelayMs) {
          await sleep(interval);
          slept += interval;
          const { data: pollState } = await supabase.from("automailsend_app_state").select("batch_send_pending").eq("user_id", user_id).single();
          if (!pollState || !pollState.batch_send_pending) {
            cancelled = true;
            break;
          }
        }
        if (cancelled) {
          console.log(pc.yellow(`[BatchSend] User ${user_id} cancelled during delay.`));
          break;
        }
      }
    }

    console.log(pc.green(`[BatchSend Worker] Finished batch for ${user_id}`));
  } catch (error) {
    console.error(pc.red(`[BatchSend Worker] Error: ${error.message}`));
  } finally {
    // Release the flags
    await supabase
      .from("automailsend_app_state")
      .update({ batch_send_pending: false, batch_send_processing: false })
      .eq("user_id", user_id);
  }
}

module.exports = { processBatchSendJob };
