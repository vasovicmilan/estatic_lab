import * as crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";

const { JWT_SECRET, AES_SECRET } = process.env;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}

if (!AES_SECRET || AES_SECRET.length !== 32) {
  throw new Error("AES_SECRET must be exactly 32 characters long");
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePasswords(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

const ALGO = "aes-256-gcm";
const KEY = Buffer.from(AES_SECRET, "utf8");

// available for any future field that needs encryption at rest (e.g. appointment
// contact snapshot phone numbers) — not used by any model yet
export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(payload) {
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function signJwt(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d", ...options });
}

export function verifyJwt(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
