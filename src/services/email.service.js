import ejs from "ejs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendEmail } from "../integrations/email/email.provider.js";
import { logError } from "../utils/logger.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_PATH = path.join(__dirname, "..", "views", "emails");

const BASE_URL = process.env.BASE_URL || "https://beautymedica.rs";
const SITE_NAME = process.env.SITE_NAME || "Estetik Lab";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "estetik.lab.ns@gmail.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || SUPPORT_EMAIL;

async function renderTemplate(templateName, data) {
  try {
    const templatePath = path.join(TEMPLATES_PATH, `${templateName}.ejs`);
    const templateContent = fs.readFileSync(templatePath, "utf8");

    return ejs.render(
      templateContent,
      { ...data, BASE_URL, SITE_NAME, SUPPORT_EMAIL, currentYear: new Date().getFullYear() },
      { cache: false, filename: templatePath, root: TEMPLATES_PATH }
    );
  } catch (error) {
    logError(`[EMAIL] Template error (${templateName})`, error);
    throw error;
  }
}

// Admin-facing notifications all get a "[SiteName] [TAG] ..." subject instead of a
// free-form sentence, so a Gmail filter matching subject:"[TERMIN]" (etc.) can
// auto-label/auto-file them — one filter per category instead of guessing at wording.
function adminSubject(tag, summary) {
  return `[${SITE_NAME}] [${tag}] ${summary}`;
}

// ==================== ACCOUNT ====================

export async function sendAccountConfirmationEmail({ email, firstName }, confirmToken) {
  const html = await renderTemplate("account-confirmation", {
    firstName,
    confirmationUrl: `${BASE_URL}/auth/verifikacija/${confirmToken}`,
  });
  return sendEmail({ to: email, subject: `Dobrodošli u ${SITE_NAME} — potvrdite vaš nalog`, html });
}

// sent when a guest booking auto-creates a lightweight account — invites them to set a
// password using the same reset-token flow as "forgot password" (see user.service.js)
export async function sendClaimAccountEmail({ email, firstName }, resetToken) {
  const html = await renderTemplate("password-reset", {
    firstName,
    resetUrl: `${BASE_URL}/preuzmi-nalog/${resetToken}`,
    isAccountClaim: true,
  });
  return sendEmail({ to: email, subject: `Vaš termin je zakazan — preuzmite vaš ${SITE_NAME} nalog`, html });
}

export async function sendPasswordResetEmail({ email, firstName }, resetToken) {
  const html = await renderTemplate("password-reset", {
    firstName,
    resetUrl: `${BASE_URL}/resetovanje-lozinke/${resetToken}`,
    isAccountClaim: false,
  });
  return sendEmail({ to: email, subject: `Reset lozinke — ${SITE_NAME}`, html });
}

export async function sendPasswordChangedEmail({ email, firstName }) {
  const html = await renderTemplate("password-changed", { firstName });
  return sendEmail({ to: email, subject: `Vaša lozinka je promenjena — ${SITE_NAME}`, html });
}

export async function sendAccountDeactivatedEmail({ email, firstName }) {
  const html = await renderTemplate("account-deactivated", { firstName });
  return sendEmail({ to: email, subject: `Nalog deaktiviran — ${SITE_NAME}`, html });
}

// ==================== APPOINTMENTS ====================

export async function sendAppointmentReceivedEmail({ email, firstName }, appointment) {
  const html = await renderTemplate("appointment-received", { firstName, appointment, manageUrl: `${BASE_URL}/nalog/termini` });
  return sendEmail({ to: email, subject: `Zahtev za termin primljen — ${SITE_NAME}`, html });
}

export async function sendAppointmentConfirmedEmail({ email, firstName }, appointment) {
  const html = await renderTemplate("appointment-confirmation", { firstName, appointment });
  return sendEmail({ to: email, subject: `Termin potvrđen — ${SITE_NAME}`, html });
}

export async function sendAppointmentCancelledEmail({ email, firstName }, appointment) {
  const html = await renderTemplate("appointment-cancelled", { firstName, appointment });
  return sendEmail({ to: email, subject: `Termin otkazan — ${SITE_NAME}`, html });
}

// generic fallback for rejected/completed/no_show status changes
export async function sendAppointmentStatusUpdateEmail({ email, firstName }, appointment, status) {
  const html = await renderTemplate("appointment-status-update", { firstName, appointment, status });
  return sendEmail({ to: email, subject: `Status termina ažuriran — ${SITE_NAME}`, html });
}

// sent to the EMPLOYEE when an appointment is (re)assigned to them by an admin
export async function sendAppointmentReassignedEmail({ email, firstName }, appointment) {
  const html = await renderTemplate("appointment-reassigned-employee", { firstName, appointment, manageUrl: `${BASE_URL}/moj-nalog/termini` });
  return sendEmail({ to: email, subject: `Novi termin dodeljen — ${SITE_NAME}`, html });
}

export async function notifyAdminNewAppointment(appointment) {
  const html = await renderTemplate("admin-new-appointment", { appointment, adminUrl: `${BASE_URL}/admin/termini/detalji/${appointment.id}` });
  const summary = `${appointment.korisnik?.ime || "Klijent"} — ${appointment.usluga?.naziv || "usluga"} (${appointment.termin?.pocetak || ""})`;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("TERMIN", summary), html });
}

export async function notifyAdminAppointmentCancelled(appointment) {
  const html = await renderTemplate("admin-appointment-cancelled", { appointment });
  const summary = `Otkazan — ${appointment.korisnik?.ime || "Klijent"} (${appointment.usluga?.naziv || "usluga"})`;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("TERMIN", summary), html });
}

// ==================== PACKAGES ====================

export async function sendPackagePurchaseCreatedEmail({ email, firstName }, purchase) {
  const html = await renderTemplate("package-purchase-created", { firstName, purchase, manageUrl: `${BASE_URL}/nalog/paketi` });
  return sendEmail({ to: email, subject: `Vaš paket je aktiviran — ${SITE_NAME}`, html });
}

export async function sendPackagePurchaseCancelledEmail({ email, firstName }, purchase) {
  const html = await renderTemplate("package-purchase-cancelled", { firstName, purchase });
  return sendEmail({ to: email, subject: `Paket otkazan — ${SITE_NAME}`, html });
}

// ==================== MARKETING ====================

export async function notifyAdminNewContact(contact) {
  const html = await renderTemplate("admin-new-contact", { contact, adminUrl: `${BASE_URL}/admin/kontakt/detalji/${contact.contactId}` });
  const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Nepoznat pošiljalac";
  const summary = contact.topic ? `${fullName} — ${contact.topic}` : fullName;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("KONTAKT", summary), html });
}

export async function notifyAdminNewTestimonial(testimonial) {
  const html = await renderTemplate("admin-new-testimonial", { testimonial });
  const stars = "★".repeat(testimonial.rating || 0);
  const summary = testimonial.subject ? `${testimonial.name || "Anonimno"} — ${testimonial.subject} (${stars})` : `${testimonial.name || "Anonimno"} (${stars})`;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("TESTIMONIJAL", summary), html });
}

export async function sendNewsletterWelcomeEmail({ email }, unsubscribeToken) {
  const html = await renderTemplate("newsletter-welcome", { unsubscribeUrl: `${BASE_URL}/newsletter/odjava/${unsubscribeToken}` });
  return sendEmail({ to: email, subject: `Dobrodošli u ${SITE_NAME} newsletter`, html });
}

export async function sendNewsletterCampaign(subscribers, campaign) {
  const results = [];
  for (const subscriber of subscribers) {
    try {
      const html = await renderTemplate("newsletter-campaign", {
        email: subscriber.email,
        campaign,
        unsubscribeUrl: `${BASE_URL}/newsletter/odjava/${subscriber.unsubscribeToken}`,
      });
      const result = await sendEmail({ to: subscriber.email, subject: campaign.subject, html });
      results.push({ email: subscriber.email, sent: true, messageId: result.messageId });
    } catch (error) {
      results.push({ email: subscriber.email, sent: false, error: error.message });
    }
  }
  return results;
}

export default {
  sendAccountConfirmationEmail,
  sendClaimAccountEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountDeactivatedEmail,
  sendAppointmentReceivedEmail,
  sendAppointmentConfirmedEmail,
  sendAppointmentCancelledEmail,
  sendAppointmentStatusUpdateEmail,
  sendAppointmentReassignedEmail,
  notifyAdminNewAppointment,
  notifyAdminAppointmentCancelled,
  sendPackagePurchaseCreatedEmail,
  sendPackagePurchaseCancelledEmail,
  notifyAdminNewContact,
  notifyAdminNewTestimonial,
  sendNewsletterWelcomeEmail,
  sendNewsletterCampaign,
};