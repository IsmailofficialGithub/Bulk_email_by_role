import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { decryptPassword } from "@/lib/crypto";
import { createClient } from "@supabase/supabase-js";
import { type Role } from "@/lib/types";

export const runtime = "nodejs";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyPlaceholders(text: string, recipient: any): string {
  return text
    .replaceAll("{{title}}", recipient.title || "")
    .replaceAll("{{email}}", recipient.email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, templates, config, delaySec, userId, accessToken } = body;

    if (!recipients || !templates || !config || !userId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    let decryptedPassword = config.appPassword;
    try {
      decryptedPassword = decryptPassword(config.appPassword);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to decrypt app password. Please re-verify SMTP config." },
        { status: 400 }
      );
    }

    // Detached background execution
    (async () => {
      const transporter = nodemailer.createTransport({
        host: config.host || "smtp.gmail.com",
        port: config.port || 465,
        secure: (config.port || 465) === 465,
        auth: {
          user: config.email,
          pass: decryptedPassword,
        },
      });

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      );

      const delayMs = Math.max(0, delaySec) * 1000;

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const tpl = templates[recipient.role as Role];
        
        if (!tpl) continue;

        const subject = applyPlaceholders(tpl.subject, recipient);
        const content = applyPlaceholders(tpl.content, recipient);
        const fromEmail = config.fromEmail || config.email;
        const fromName = config.fromName;
        const toEmail = recipient.email;

        try {
          await transporter.sendMail({
            from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
            to: toEmail,
            subject,
            text: content,
            html: content.replace(/\n/g, "<br>"),
            attachments: tpl.files.map((a: any) => ({
              filename: a.name,
              path: a.url,
              contentType: a.type,
            })),
          });

          // Log success
          await supabase.from("automailsend_sent_log").insert({
            user_id: userId,
            email: recipient.email.toLowerCase(),
            role: recipient.role,
            title: recipient.title,
            status: "sent",
            sent_at: new Date().toISOString(),
          });

          // Update recipient status
          await supabase.from("automailsend_recipients")
            .update({ status: "sent" })
            .eq("user_id", userId)
            .eq("email", recipient.email);

        } catch (error) {
          const errMessage = error instanceof Error ? error.message : "Send failed";
          
          // Log error
          await supabase.from("automailsend_sent_log").insert({
            user_id: userId,
            email: recipient.email.toLowerCase(),
            role: recipient.role,
            title: recipient.title,
            status: "failed",
            error_message: errMessage,
            sent_at: new Date().toISOString(),
          });

          // Update recipient status
          await supabase.from("automailsend_recipients")
            .update({ status: "failed" })
            .eq("user_id", userId)
            .eq("email", recipient.email);
        }

        if (i < recipients.length - 1 && delayMs > 0) {
          await sleep(delayMs);
        }
      }
    })().catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Batch sending started in background",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start batch send";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
