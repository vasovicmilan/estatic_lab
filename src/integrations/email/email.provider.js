import nodemailer from "nodemailer";
import { logInfo, logError } from "../../utils/logger.util.js";

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

export async function sendEmail({ to, subject, html, attachments = [] }) {
  try {
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || "Estatik Lab"}" <${process.env.EMAIL_FROM || "estetik.lab.ns@gmail.com"}>`,
      to,
      subject,
      html,
      attachments,
    };

    const info = await getTransporter().sendMail(mailOptions);

    if (process.env.NODE_ENV === "development") {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      logInfo(`[EMAIL] Preview URL: ${previewUrl || "N/A"}`);
    }

    return { sent: true, messageId: info.messageId };
  } catch (error) {
    logError(`[EMAIL] Failed to send email to ${to}`, error);
    throw error;
  }
}
