import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.PAYMENTS_ENC_KEY;
  if (!key) {
    throw new Error("Missing PAYMENTS_ENC_KEY in environment variables");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("PAYMENTS_ENC_KEY must be a 32-byte base64 string");
  }
  return buf;
}

export function encryptConfig(config: any): string {
  if (!config) return "";
  
  const text = JSON.stringify(config);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptConfig(encryptedStr: string | null): any {
  if (!encryptedStr) return {};
  
  try {
    const parts = encryptedStr.split(":");
    if (parts.length !== 3) return {};
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return JSON.parse(decrypted);
  } catch (e) {
    console.error("Failed to decrypt gateway config:", e);
    return {};
  }
}
