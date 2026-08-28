import ejs from "ejs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendEmail } from "../integrations/email/email.provider.js";
import { logError } from "../utils/logger.util.js";
import { generateOrderInvoicePdf } from "../utils/invoice-pdf.util.js";
import { generateBusinessReportPdf } from "../utils/business-report-pdf.util.js";
import { infoRow, infoTable, statusTone, badge, ctaButton, linkFallback, couponBlock } from "../utils/email-content.util.js";
import { formatDateTime } from "../utils/date.time.util.js";
import { getCurrency } from "../config/runtime-settings.cache.js";
import { formatMoney } from "../utils/price.util.js";
import { WELCOME_COUPON_CODE, WELCOME_COUPON_DISCOUNT_VALUE } from "../config/marketing.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_PATH = path.join(__dirname, "..", "views", "emails");

const BASE_URL = process.env.BASE_URL || "https://beautymedica.rs";
const SITE_NAME = process.env.SITE_NAME || "Estetik Lab";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "estetik.lab.ns@gmail.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || SUPPORT_EMAIL;

// Exported (unlike this file's other internal helpers) specifically so tests
// can render a real template through the exact same locals every actual
// email goes through - SITE_NAME, formatMoney, infoRow, etc. - rather than
// hand-rolling a duplicate list that silently drifts out of sync whenever
// this list changes. (Which is exactly what broke
// test/integration/jobs/business-report-jobs.test.js: its own local
// ejs.render() call didn't know about SITE_NAME.)
export async function renderTemplate(templateName, data) {
  try {
    const templatePath = path.join(TEMPLATES_PATH, `${templateName}.ejs`);
    const templateContent = fs.readFileSync(templatePath, "utf8");

    return ejs.render(
      templateContent,
      {
        ...data,
        BASE_URL,
        SITE_NAME,
        SUPPORT_EMAIL,
        currentYear: new Date().getFullYear(),
        currencySymbol: getCurrency().symbol,
        formatMoney,
        infoRow,
        infoTable,
        statusTone,
        badge,
        ctaButton,
        linkFallback,
        couponBlock,
      },
      { cache: false, filename: templatePath, root: TEMPLATES_PATH }
    );
  } catch (error) {
    logError(`[EMAIL] Template error (${templateName})`, error);
    throw error;
  }
}

// Admin-facing notifications all get a "[SiteName] [TAG] ..." subject instead of a
// free-form sentence, so a Gmail filter matching subject:"[TERMIN]" (etc.) can
// auto-label/auto-file them - one filter per category instead of guessing at wording.
function adminSubject(tag, summary) {
  return `[${SITE_NAME}] [${tag}] ${summary}`;
}

// ==================== ACCOUNT ====================

export async function sendAccountConfirmationEmail({ email, firstName }, confirmToken) {
  const html = await renderTemplate("account-confirmation", {
    firstName,
    confirmationUrl: `${BASE_URL}/auth/verifikacija/${confirmToken}`,
    couponCode: WELCOME_COUPON_CODE,
    couponDiscount: WELCOME_COUPON_DISCOUNT_VALUE,
  });
  return sendEmail({ to: email, subject: `Dobrodošli u ${SITE_NAME} - potvrdite vaš nalog`, html });
}

// Google sign-ins skip account confirmation entirely (their email is already
// verified by Google - see auth.service.js's googleAuth / email.listener.js's
// user:registered handler), so this is their one and only "you're in" moment.
// Without it a Google-registered user got no email at all and no welcome coupon,
// unlike the password/registration flow above.
export async function sendWelcomeEmail({ email, firstName }) {
  const html = await renderTemplate("welcome", {
    firstName,
    couponCode: WELCOME_COUPON_CODE,
    couponDiscount: WELCOME_COUPON_DISCOUNT_VALUE,
  });
  return sendEmail({ to: email, subject: `Dobrodošli u ${SITE_NAME}!`, html });
}

// sent when a guest booking auto-creates a lightweight account - invites them to set a
// password using the same reset-token flow as "forgot password" (see user.service.js)
export async function sendClaimAccountEmail({ email, firstName }, resetToken) {
  const html = await renderTemplate("password-reset", {
    firstName,
    resetUrl: `${BASE_URL}/preuzmi-nalog/${resetToken}`,
    isAccountClaim: true,
  });
  return sendEmail({ to: email, subject: `Vaš termin je zakazan - preuzmite vaš ${SITE_NAME} nalog`, html });
}

export async function sendPasswordResetEmail({ email, firstName }, resetToken) {
  const html = await renderTemplate("password-reset", {
    firstName,
    resetUrl: `${BASE_URL}/resetovanje-lozinke/${resetToken}`,
    isAccountClaim: false,
  });
  return sendEmail({ to: email, subject: `Reset lozinke - ${SITE_NAME}`, html });
}

export async function sendPasswordChangedEmail({ email, firstName }) {
  const html = await renderTemplate("password-changed", { firstName });
  return sendEmail({ to: email, subject: `Vaša lozinka je promenjena - ${SITE_NAME}`, html });
}

export async function sendAccountDeactivatedEmail({ email, firstName }) {
  const html = await renderTemplate("account-deactivated", { firstName });
  return sendEmail({ to: email, subject: `Nalog deaktiviran - ${SITE_NAME}`, html });
}

// ==================== APPOINTMENTS ====================

export async function sendAppointmentReceivedEmail({ email, firstName }, appointment) {
  const html = await renderTemplate("appointment-received", { firstName, appointment, manageUrl: `${BASE_URL}/nalog/termini` });
  return sendEmail({ to: email, subject: `Zahtev za termin primljen - ${SITE_NAME}`, html });
}

export async function sendAppointmentConfirmedEmail({ email, firstName }, appointment) {
  const html = await renderTemplate("appointment-confirmation", { firstName, appointment });
  return sendEmail({ to: email, subject: `Termin potvrđen - ${SITE_NAME}`, html });
}

export async function sendAppointmentCancelledEmail({ email, firstName }, appointment) {
  const html = await renderTemplate("appointment-cancelled", { firstName, appointment });
  return sendEmail({ to: email, subject: `Termin otkazan - ${SITE_NAME}`, html });
}

// One template, reused for both the 24h and 4h reminder (see
// appointment-reminder-jobs.js) - the subject line is the only thing that
// differs between the two, the body always shows the actual date/time rather
// than claiming "tomorrow"/"in 4 hours", which stays accurate even if a
// reminder ends up firing later than its usual window (e.g. after downtime -
// see appointment.repository.js's findAppointmentsDueForReminder).
export async function sendAppointmentReminderEmail({ email, firstName }, appointment, hoursBefore) {
  const html = await renderTemplate("appointment-reminder", { firstName, appointment });
  const subject = hoursBefore >= 24 ? `Podsetnik: termin sutra - ${SITE_NAME}` : `Podsetnik: termin danas - ${SITE_NAME}`;
  return sendEmail({ to: email, subject, html });
}

// generic fallback for rejected/completed/no_show status changes
export async function sendAppointmentStatusUpdateEmail({ email, firstName }, appointment, status) {
  const html = await renderTemplate("appointment-status-update", { firstName, appointment, status });
  return sendEmail({ to: email, subject: `Status termina ažuriran - ${SITE_NAME}`, html });
}

// covers approved/paid/rejected - one partner or commission-employee at a time
export async function sendPayoutStatusUpdateEmail({ email, firstName }, payoutRequest, status) {
  const html = await renderTemplate("payout-status-update", { firstName, payoutRequest, status });
  return sendEmail({ to: email, subject: `Status zahteva za isplatu ažuriran - ${SITE_NAME}`, html });
}

// sent to the EMPLOYEE when an appointment is (re)assigned to them by an admin
export async function sendAppointmentReassignedEmail({ email, firstName }, appointment) {
  const html = await renderTemplate("appointment-reassigned-employee", { firstName, appointment, manageUrl: `${BASE_URL}/moj-nalog/termini` });
  return sendEmail({ to: email, subject: `Novi termin dodeljen - ${SITE_NAME}`, html });
}

export async function notifyAdminNewAppointment(appointment) {
  const html = await renderTemplate("admin-new-appointment", { appointment, adminUrl: `${BASE_URL}/admin/termini/detalji/${appointment.id}` });
  const summary = `${appointment.korisnik?.ime || "Klijent"} - ${appointment.usluga?.naziv || "usluga"} (${appointment.termin?.pocetak || ""})`;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("TERMIN", summary), html });
}

export async function notifyAdminAppointmentCancelled(appointment) {
  const html = await renderTemplate("admin-appointment-cancelled", { appointment });
  const summary = `Otkazan - ${appointment.korisnik?.ime || "Klijent"} (${appointment.usluga?.naziv || "usluga"})`;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("TERMIN", summary), html });
}

// ==================== ORDERS ====================

export async function sendOrderConfirmationRequestEmail({ email, firstName }, { temporaryOrderId, verificationToken, tokenExpiration }) {
  const html = await renderTemplate("order-confirmation-request", {
    firstName,
    confirmUrl: `${BASE_URL}/korpa/potvrda/${temporaryOrderId}/${verificationToken}`,
    tokenExpiration: formatDateTime(tokenExpiration),
  });
  return sendEmail({ to: email, subject: `Potvrdite porudžbinu - ${SITE_NAME}`, html });
}

export async function sendOrderReceivedEmail({ email, firstName }, order) {
  const html = await renderTemplate("order-received", { firstName, order, manageUrl: `${BASE_URL}/nalog/porudzbine` });

  let attachments = [];
  try {
    const pdfBuffer = await generateOrderInvoicePdf(order);
    attachments = [{ filename: `porudzbina-${order.id}.pdf`, content: pdfBuffer, contentType: "application/pdf" }];
  } catch (error) {
    logError("[EMAIL] Failed to generate order invoice PDF - sending confirmation without it", error, { orderId: order.id });
  }

  return sendEmail({ to: email, subject: `Porudžbina potvrđena - ${SITE_NAME}`, html, attachments });
}

// generic fallback for processing/shipped/delivered/completed/cancelled/returned/refunded
export async function sendOrderStatusUpdateEmail({ email, firstName }, order, status) {
  const html = await renderTemplate("order-status-update", { firstName, order, status });
  return sendEmail({ to: email, subject: `Status porudžbine ažuriran - ${SITE_NAME}`, html });
}

export async function notifyAdminNewOrder(order) {
  const html = await renderTemplate("admin-new-order", { order, adminUrl: `${BASE_URL}/admin/porudzbine/detalji/${order.id}` });
  const summary = `${order.korisnik?.ime || "Klijent"} - ${order.ukupnaCena || ""}`;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("PORUDŽBINA", summary), html });
}

// only fired when the CUSTOMER cancels their own order - admin already knows about
// cancellations they trigger themselves, same reasoning as notifyAdminAppointmentCancelled
export async function notifyAdminOrderCancelled(order) {
  const html = await renderTemplate("admin-order-cancelled", { order, adminUrl: `${BASE_URL}/admin/porudzbine/detalji/${order.id}` });
  const summary = `Otkazano od kupca - ${order.korisnik?.ime || "Klijent"} (${order.ukupnaCena || ""})`;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("PORUDŽBINA", summary), html });
}

// ==================== PRODUCTS ====================

export async function notifyAdminStockAlert({ productId, productName, sku, variantLabel, stock, isOutOfStock }) {
  const html = await renderTemplate("admin-stock-alert", {
    productName,
    sku,
    variantLabel,
    stock,
    isOutOfStock,
    adminUrl: `${BASE_URL}/admin/proizvodi/izmena/${productId}`,
  });
  const label = isOutOfStock ? "RASPRODATO" : "NISKO STANJE";
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject(label, `${productName} - ${variantLabel}`), html });
}

// ==================== PACKAGES ====================

export async function sendPackagePurchaseCreatedEmail({ email, firstName }, purchase) {
  const html = await renderTemplate("package-purchase-created", { firstName, purchase, manageUrl: `${BASE_URL}/nalog/paketi` });
  return sendEmail({ to: email, subject: `Vaš paket je aktiviran - ${SITE_NAME}`, html });
}

export async function sendPackagePurchaseCancelledEmail({ email, firstName }, purchase) {
  const html = await renderTemplate("package-purchase-cancelled", { firstName, purchase });
  return sendEmail({ to: email, subject: `Paket otkazan - ${SITE_NAME}`, html });
}

// ==================== MARKETING ====================

export async function notifyAdminNewContact(contact) {
  const html = await renderTemplate("admin-new-contact", { contact, adminUrl: `${BASE_URL}/admin/kontakt/detalji/${contact.contactId}` });
  const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Nepoznat pošiljalac";
  const summary = contact.topic ? `${fullName} - ${contact.topic}` : fullName;
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("KONTAKT", summary), html });
}

export async function notifyAdminNewTestimonial(testimonial) {
  const html = await renderTemplate("admin-new-testimonial", { testimonial });
  const stars = "★".repeat(testimonial.rating || 0);
  const summary = testimonial.subject ? `${testimonial.name || "Anonimno"} - ${testimonial.subject} (${stars})` : `${testimonial.name || "Anonimno"} (${stars})`;
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

// ==================== ADMIN REPORTS ====================

export async function sendLogReportEmail(periodLabel, dateRangeLabel, summary, attachments = []) {
  const html = await renderTemplate("admin-log-report", { periodLabel, dateRangeLabel, ...summary });
  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("IZVEŠTAJ", `${periodLabel} (${dateRangeLabel})`), html, attachments });
}

// Business metrics (bookings, sales, commissions...) - a genuinely different
// report from sendLogReportEmail above, which covers operational/traffic
// metrics only (see docs section 14's distinction between operational
// reporting and the business side). Kept as a clearly separate function/
// template rather than folding into the same one, since the two answer
// different questions for a different reason to care.
export async function sendBusinessReportEmail(periodLabel, dateRangeLabel, summary) {
  const html = await renderTemplate("admin-business-report", { periodLabel, dateRangeLabel, ...summary });

  // Same "never let a PDF failure block the email itself" pattern as
  // sendOrderReceivedEmail's invoice attachment above - the HTML report is
  // the essential part, the PDF is a nice-to-have printable/archivable copy.
  let attachments = [];
  try {
    const pdfBuffer = await generateBusinessReportPdf(periodLabel, dateRangeLabel, summary);
    attachments = [{ filename: `poslovni-izvestaj-${summary.periodKey}.pdf`, content: pdfBuffer, contentType: "application/pdf" }];
  } catch (error) {
    logError("[EMAIL] Failed to generate business report PDF - sending report without it", error, { periodLabel, periodKey: summary.periodKey });
  }

  return sendEmail({ to: ADMIN_EMAIL, subject: adminSubject("POSLOVNI IZVEŠTAJ", `${periodLabel} (${dateRangeLabel})`), html, attachments });
}

export default {
  sendAccountConfirmationEmail,
  sendWelcomeEmail,
  sendClaimAccountEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountDeactivatedEmail,
  sendAppointmentReceivedEmail,
  sendAppointmentConfirmedEmail,
  sendAppointmentCancelledEmail,
  sendAppointmentReminderEmail,
  sendAppointmentStatusUpdateEmail,
  sendPayoutStatusUpdateEmail,
  sendAppointmentReassignedEmail,
  notifyAdminNewAppointment,
  notifyAdminAppointmentCancelled,
  sendOrderConfirmationRequestEmail,
  sendOrderReceivedEmail,
  sendOrderStatusUpdateEmail,
  notifyAdminNewOrder,
  notifyAdminOrderCancelled,
  notifyAdminStockAlert,
  sendPackagePurchaseCreatedEmail,
  sendPackagePurchaseCancelledEmail,
  notifyAdminNewContact,
  notifyAdminNewTestimonial,
  sendNewsletterWelcomeEmail,
  sendNewsletterCampaign,
  sendLogReportEmail,
  sendBusinessReportEmail,
  renderTemplate,
};