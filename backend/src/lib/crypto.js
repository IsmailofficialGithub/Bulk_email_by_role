const crypto = require("crypto");

// 32-byte hex string expected
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";
const ALGORITHM = "aes-256-gcm";

function decryptPassword(encryptedText) {
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

module.exports = { decryptPassword };
