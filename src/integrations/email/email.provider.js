import nodemailer from "nodemailer";
import { logInfo, logWarn, logError } from "../../utils/logger.util.js";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

const MAX_SEND_ATTEMPTS = parseInt(process.env.EMAIL_MAX_SEND_ATTEMPTS || "3", 10);
const RETRY_BASE_DELAY_MS = 1000; // 1s, then 3s, then 9s, ... (3^attempt)

// SMTP replies use response codes: 4xx = temporary (mailbox full, greylisting, rate
// limiting - worth retrying), 5xx = permanent (bad address, domain doesn't exist -
// retrying is pointless and just delays the caller). Connection-level Node errors
// (timeouts, DNS hiccups, the server resetting the connection) are also transient.
const RETRYABLE_NODE_ERROR_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ESOCKET", "EDNS", "EAI_AGAIN"]);

function isRetryableError(error) {
  if (error?.responseCode) return error.responseCode >= 400 && error.responseCode < 500;
  if (error?.code && RETRYABLE_NODE_ERROR_CODES.has(error.code)) return true;
  // Unknown shape (e.g. auth misconfigured) - safer to not hammer the SMTP server
  // with retries that will just fail the same way every time.
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail({ to, subject, html, attachments = [] }) {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || "Estetik Lab"}" <${process.env.EMAIL_FROM || "estetik.lab.ns@gmail.com"}>`,
    to,
    subject,
    html,
    attachments,
  };

  let lastError;

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const info = await getTransporter().sendMail(mailOptions);

      if (process.env.NODE_ENV === "development") {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        logInfo(`[EMAIL] Preview URL: ${previewUrl || "N/A"}`);
      }
      if (attempt > 1) {
        logInfo(`[EMAIL] Sent to ${to} on retry attempt ${attempt}/${MAX_SEND_ATTEMPTS}`);
      }

      return { sent: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      const willRetry = attempt < MAX_SEND_ATTEMPTS && isRetryableError(error);

      if (willRetry) {
        const waitMs = RETRY_BASE_DELAY_MS * 3 ** (attempt - 1);
        logWarn(`[EMAIL] Send to ${to} failed (attempt ${attempt}/${MAX_SEND_ATTEMPTS}), retrying in ${waitMs}ms`, {
          to,
          subject,
          errorCode: error.code || error.responseCode,
        });
        await delay(waitMs);
        continue;
      }

      break;
    }
  }

  logError(`[EMAIL] Failed to send email to ${to} after ${MAX_SEND_ATTEMPTS} attempt(s)`, lastError, { to, subject });
  throw lastError;
}