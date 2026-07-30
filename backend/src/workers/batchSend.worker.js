const { Worker } = require("bullmq");
const pc = require("picocolors");
const nodemailer = require("nodemailer");
const { connection } = require("../config/redis");
const { supabase } = require("../config/supabase");
const { decryptPassword } = require("../lib/crypto");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyPlaceholders(text, recipient) {
  return text
    .replaceAll("{{title}}", recipient.title || "")
    .replaceAll("{{email}}", recipient.email);
}

const batchSendWorker = new Worker("batchSendQueue", async (job) => {
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

    const config = userState.config || {};
    const defaultInterval = process.env.BATCH_INTERVAL_SEC ? parseInt(process.env.BATCH_INTERVAL_SEC, 10) : 3;
    const delaySec = userState.delay_sec || defaultInterval;

    if (!config.email || !config.appPassword) {
      throw new Error("SMTP config missing");
    }

    let decryptedPassword;
    try {
      decryptedPassword = decryptPassword(config.appPassword);
    } catch {
      throw new Error("Failed to decrypt app password");
    }

    const { data: templatesArray } = await supabase
      .from("automailsend_templates")
      .select("*")
      .eq("user_id", user_id);
    
    if (!templatesArray || templatesArray.length === 0) {
      console.log(pc.yellow(`[BatchSend] No templates found for ${user_id}`));
      return;
    }

    const templates = {};
    for (const t of templatesArray) {
      templates[t.role] = t;
    }

    // 2. Fetch sent logs to filter out what has already been sent
    const { data: sentLog } = await supabase
      .from("automailsend_sent_log")
      .select("email, role")
      .eq("user_id", user_id)
      .in("status", ["sent", "skipped"]);
    
    const sentKeys = new Set((sentLog || []).map(s => `${s.email}::${s.role}`));

    // 3. Fetch pending recipients
    const { data: recipients } = await supabase
      .from("automailsend_recipients")
      .select("*")
      .eq("user_id", user_id);

    const toProcess = (recipients || []).filter(r => !sentKeys.has(`${r.email}::${r.role}`));

    if (toProcess.length === 0) {
      console.log(pc.green(`[BatchSend] No new emails to send for ${user_id}`));
      return;
    }

    // 4. Setup Transporter
    const transporter = nodemailer.createTransport({
      host: config.host || "smtp.gmail.com",
      port: config.port || 465,
      secure: (config.port || 465) === 465,
      auth: {
        user: config.email,
        pass: decryptedPassword,
      },
    });

    const delayMs = delaySec * 1000;

    // 5. Send loop
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
      const tpl = templates[recipient.role];
      if (!tpl) continue;

      const subject = applyPlaceholders(tpl.subject, recipient);
      const content = applyPlaceholders(tpl.content, recipient);
      const fromEmail = config.fromEmail || config.email;
      const fromName = config.fromName;

      try {
        await transporter.sendMail({
          from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
          to: recipient.email,
          subject,
          text: content,
          html: content.replace(/\n/g, "<br>"),
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
        while (slept < delayMs) {
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
    await supabase.from("automailsend_app_state")
      .update({ batch_send_pending: false, batch_send_processing: false })
      .eq("user_id", user_id);
  }
}, { connection, concurrency: 5 });

batchSendWorker.on("failed", (job, err) => {
  console.error(pc.red(`[BatchSend Worker] Job ${job.id} failed: ${err.message}`));
});

module.exports = batchSendWorker;
