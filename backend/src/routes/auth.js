const express = require("express");
const nodemailer = require("nodemailer");
const { supabase } = require("../config/supabase");

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { email, password, siteUrl } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    // 1. Generate Signup Link via Supabase Admin API (This creates the user but doesn't send the built-in email)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      password: password,
    });

    if (linkError) {
      return res.status(400).json({ error: linkError.message });
    }

    const actionLink = linkData.properties?.action_link;
    const userId = linkData.user?.id;

    if (!actionLink || !userId) {
      throw new Error("Failed to generate confirmation link from Supabase.");
    }

    // 2. Prepare SMTP configuration
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
    const secure = port === 465;
    const smtpUser = process.env.SMTP_EMAIL;
    const smtpPass = process.env.SMTP_PASSWORD;

    if (!smtpUser || !smtpPass) {
      // Rollback user if no SMTP
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ 
        error: "Server SMTP configuration is missing. Please set SMTP_EMAIL and SMTP_PASSWORD in backend environment." 
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // 3. Send custom email with the real confirmation link
    try {
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'AutoMail'}" <${smtpUser}>`,
        to: email,
        subject: "Welcome to Viddr - Please verify your email",
        text: `Thank you for signing up to Viddr! Please verify your email by visiting this link: ${actionLink}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Welcome to Viddr!</h2>
            <p>Hello,</p>
            <p>Thank you for signing up. Please verify your email address to activate your account.</p>
            <br/>
            <a href="${actionLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
            <br/><br/>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p><a href="${actionLink}">${actionLink}</a></p>
            <br/>
            <p>Best regards,<br/>The Viddr Team</p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Rollback if email fails
      console.error("[Auth Route] Failed to send email, rolling back user:", emailErr);
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: "Failed to send welcome email. Account creation cancelled." });
    }

    res.status(200).json({ success: true, message: "Signup successful, confirmation email sent." });
  } catch (error) {
    console.error("[Auth Route] Signup error:", error);
    res.status(500).json({ error: "An unexpected error occurred during signup." });
  }
});

module.exports = router;
