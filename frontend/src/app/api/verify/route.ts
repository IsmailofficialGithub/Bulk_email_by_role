import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { encryptPassword, decryptPassword } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, appPassword } = await request.json();

    if (!email || !appPassword) {
      return NextResponse.json(
        { success: false, error: "Email and app password are required" },
        { status: 400 }
      );
    }
    
    let passwordToVerify = appPassword;
    if (passwordToVerify.startsWith("enc:")) {
      try {
        passwordToVerify = decryptPassword(passwordToVerify);
      } catch (err) {
        return NextResponse.json(
          { success: false, error: "Failed to decrypt existing password" },
          { status: 400 }
        );
      }
    }
    
    // Remove any spaces just in case the user pasted them
    passwordToVerify = passwordToVerify.replace(/\s+/g, "");
    // However, the verify flow from UI always sends plain text if the user types it.
    // If the user clicks Verify without changing, it sends the masked or encrypted string. We should handle that in UI.

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: email,
        pass: passwordToVerify,
      },
    });

    await transporter.verify();
    
    const encryptedPassword = appPassword.startsWith("enc:") 
      ? appPassword 
      : encryptPassword(passwordToVerify);

    return NextResponse.json({ success: true, message: "SMTP config verified", encryptedPassword });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify SMTP config";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
