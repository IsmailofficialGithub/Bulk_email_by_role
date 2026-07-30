import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { decryptPassword } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromName, email, fromEmail, appPassword, host, port, toEmail, subject, content, attachments = [] } = body;

    if (!email || !appPassword || !host || !port || !toEmail || !subject) {
      return NextResponse.json(
        {
          success: false,
          error: "email, appPassword, toEmail, and subject are required",
        },
        { status: 400 }
      );
    }
    
    let decryptedPassword = appPassword;
    try {
      decryptedPassword = decryptPassword(appPassword);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to decrypt app password. Please re-verify SMTP config." },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: {
        user: email,
        pass: decryptedPassword,
      },
    });

    const senderEmail = fromEmail || email;
    const info = await transporter.sendMail({
      from: fromName ? `"${fromName}" <${senderEmail}>` : senderEmail,
      to: toEmail,
      subject,
      text: content,
      html: content.replace(/\n/g, "<br>"),
      attachments: attachments.map((a: { filename: string; path: string; contentType: string }) => ({
        filename: a.filename,
        path: a.path, // This is the public URL
        contentType: a.contentType,
      })),
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      email: toEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
