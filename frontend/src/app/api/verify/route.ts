import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { encryptPassword } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, appPassword } = await request.json();

    if (!email || !appPassword) {
      return NextResponse.json(
        { success: false, error: "Email and app password are required" },
        { status: 400 }
      );
    }
    
    // If it's already encrypted (e.g. re-verifying), we should probably fail because nodemailer needs plain text.
    // However, the verify flow from UI always sends plain text if the user types it.
    // If the user clicks Verify without changing, it sends the masked or encrypted string. We should handle that in UI.

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
    
    const encryptedPassword = encryptPassword(appPassword);

    return NextResponse.json({ success: true, message: "SMTP config verified", encryptedPassword });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify SMTP config";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
