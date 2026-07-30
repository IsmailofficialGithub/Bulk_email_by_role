import crypto from "crypto";

// 32-byte hex string expected
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";
const ALGORITHM = "aes-256-gcm";

export function encryptPassword(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is missing in environment variables.");
  }
  
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters).");
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: enc:iv:authTag:encryptedData
  return `enc:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptPassword(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is missing in environment variables.");
  }

  if (!encryptedText.startsWith("enc:")) {
    // Legacy support: if it's not encrypted, just return it
    return encryptedText;
  }

  const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
  const parts = encryptedText.split(":");
  
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted format.");
  }

  const iv = Buffer.from(parts[1], "hex");
  const authTag = Buffer.from(parts[2], "hex");
  const encryptedData = parts[3];

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
