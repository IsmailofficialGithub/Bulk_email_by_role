const express = require("express");
const nodemailer = require("nodemailer");
const { supabase } = require("../config/supabase");

const router = express.Router();

router.post("/send-confirmation", async (req, res) => {
  const { to, subject, text, html, userId } = req.body;

  try {
    if (!to) {
      return res.status(400).json({ error: "Missing 'to' address" });
    }

    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
    const secure = port === 465;
    const user = process.env.SMTP_EMAIL;
    const pass = process.env.SMTP_PASSWORD;

    if (!user || !pass) {
      throw new Error("Server SMTP configuration is missing. Please set SMTP_EMAIL and SMTP_PASSWORD in backend environment.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'AutoMail'}" <${user}>`,
      to,
      subject: subject || "Confirm your email",
      text: text || "Please confirm your action.",
      html: html || "<p>Please confirm your action.</p>",
    });

    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("[Email Route] Send error:", error);
    
    // If the email fails to send and we have a userId, we rollback the account creation
    if (userId) {
      console.log(`[Email Route] Rolling back account creation for user ${userId} because email failed.`);
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (deleteErr) {
        console.error(`[Email Route] Failed to rollback user ${userId}:`, deleteErr);
      }
    }

    res.status(500).json({ error: "Failed to send email", details: error.message });
  }
});

module.exports = router;
