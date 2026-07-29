import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromEmail, appPassword, toEmail, subject, content, attachments = [] } = body;

    if (!fromEmail || !appPassword || !toEmail || !subject) {
      return NextResponse.json(
        {
          success: false,
          error: "fromEmail, appPassword, toEmail, and subject are required",
        },
        { status: 400 }
      );
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
      attachments: attachments.map((a: any) => ({
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
