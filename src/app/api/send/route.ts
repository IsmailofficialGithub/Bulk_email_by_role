import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const fromEmail = String(formData.get("fromEmail") || "");
    const appPassword = String(formData.get("appPassword") || "");
    const toEmail = String(formData.get("toEmail") || "");
    const subject = String(formData.get("subject") || "");
    const content = String(formData.get("content") || "");

    if (!fromEmail || !appPassword || !toEmail || !subject) {
      return NextResponse.json(
        {
          success: false,
          error: "fromEmail, appPassword, toEmail, and subject are required",
        },
        { status: 400 }
      );
    }

    const attachments: { filename: string; content: Buffer; contentType?: string }[] =
      [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("attachment_") && value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        attachments.push({
          filename: value.name,
          content: buffer,
          contentType: value.type || undefined,
        });
      }
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: fromEmail,
        pass: appPassword,
      },
    });

    const info = await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject,
      text: content,
      html: content.replace(/\n/g, "<br>"),
      attachments,
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
