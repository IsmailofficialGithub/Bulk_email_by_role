import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email, appPassword } = await request.json();

    if (!email || !appPassword) {
      return NextResponse.json(
        { success: false, error: "Email and app password are required" },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: email,
        pass: appPassword,
      },
    });

    await transporter.verify();

    return NextResponse.json({ success: true, message: "SMTP config verified" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify SMTP config";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
