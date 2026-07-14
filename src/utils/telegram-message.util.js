function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatPrice(value) {
  return Number(value || 0).toFixed(0);
}

export function buildNewAppointmentMessage(appointment) {
  const fullName = `${appointment.firstName || ""} ${appointment.lastName || ""}`.trim();

  return [
    `📅 <b>Novi termin zakazan</b>`,
    "",
    `👤 <b>Klijent:</b> ${escapeHtml(fullName || "-")}`,
    `📧 <b>Email:</b> ${escapeHtml(appointment.email || "-")}`,
    `💆 <b>Usluga:</b> ${escapeHtml(appointment.serviceName || "-")}`,
    `🕐 <b>Termin:</b> ${escapeHtml(appointment.startTime || "-")}`,
    `💰 <b>Cena:</b> ${formatPrice(appointment.finalPrice)} RSD`,
  ].join("\n");
}

export function buildAppointmentCancelledMessage(appointment) {
  const base = buildNewAppointmentMessage(appointment);
  return base.replace("📅 <b>Novi termin zakazan", "❌ <b>Termin otkazan");
}

export function buildAppointmentStatusChangeMessage(appointment, oldStatus, newStatus) {
  const fullName = `${appointment.firstName || ""} ${appointment.lastName || ""}`.trim();

  return [
    `🔄 <b>Status termina promenjen</b>`,
    "",
    `👤 <b>Klijent:</b> ${escapeHtml(fullName || "-")}`,
    `💆 <b>Usluga:</b> ${escapeHtml(appointment.serviceName || "-")}`,
    `📊 <b>Status:</b> ${escapeHtml(oldStatus)} → <b>${escapeHtml(newStatus)}</b>`,
  ].join("\n");
}

export function buildNewContactMessage(contact) {
  return [
    `📩 <b>Nova kontakt poruka</b>`,
    "",
    `👤 <b>Ime:</b> ${escapeHtml(`${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "-")}`,
    `📧 <b>Email:</b> ${escapeHtml(contact.email || "-")}`,
    `💬 <b>Poruka:</b> ${escapeHtml((contact.message || "").substring(0, 200))}`,
  ].join("\n");
}

export function buildNewTestimonialMessage(testimonial) {
  return [
    `⭐ <b>Novi testimonijal — čeka odobrenje</b>`,
    "",
    `👤 <b>Ime:</b> ${escapeHtml(testimonial.name || "-")}`,
    `⭐ <b>Ocena:</b> ${"★".repeat(testimonial.rating || 0)}${"☆".repeat(5 - (testimonial.rating || 0))}`,
    `💬 <b>Komentar:</b> ${escapeHtml((testimonial.message || "").substring(0, 200))}`,
  ].join("\n");
}

export function buildNewUserMessage(user) {
  return [
    `👤 <b>Nova registracija</b>`,
    "",
    `📧 <b>Email:</b> ${escapeHtml(user.email || "-")}`,
    `👤 <b>Ime:</b> ${escapeHtml(`${user.firstName || ""} ${user.lastName || ""}`.trim())}`,
    `🔑 <b>Provider:</b> ${escapeHtml(user.provider || "local")}`,
  ].join("\n");
}

export function buildNewPackagePurchaseMessage(purchase) {
  return [
    `📦 <b>Novi paket dodeljen</b>`,
    "",
    `👤 <b>Korisnik:</b> ${escapeHtml(purchase.korisnik || "-")}`,
    `📦 <b>Paket:</b> ${escapeHtml(purchase.paket || "-")}`,
    `💰 <b>Plaćeno:</b> ${formatPrice(purchase.placeno)} RSD`,
  ].join("\n");
}

export function buildAppointmentReassignedMessage(appointment, employeeName) {
  return [
    `🔁 <b>Termin preraspoređen</b>`,
    "",
    `👤 <b>Klijent:</b> ${escapeHtml(appointment.korisnik?.ime || "-")}`,
    `💆 <b>Usluga:</b> ${escapeHtml(appointment.usluga?.naziv || "-")}`,
    `🕐 <b>Termin:</b> ${escapeHtml(appointment.termin?.pocetak || "-")}`,
    `➡️ <b>Novi terapeut:</b> ${escapeHtml(employeeName || "-")}`,
  ].join("\n");
}

// intentionally generic — the caller decides what "message" and "context" mean.
// Used only by the listener modules' own error-handling paths (see
// events/*.listeners.js), never wired into the general-purpose logger — see the note
// on telegram.service.js's notifyError-equivalent usage.
export function buildErrorAlertMessage(message, context = {}) {
  const contextStr = Object.keys(context).length ? `\n<code>${escapeHtml(JSON.stringify(context))}</code>` : "";
  return [`🚨 <b>Greška</b>`, "", escapeHtml(message) + contextStr].join("\n");
}

export default {
  buildNewAppointmentMessage,
  buildAppointmentCancelledMessage,
  buildAppointmentStatusChangeMessage,
  buildNewContactMessage,
  buildNewTestimonialMessage,
  buildNewUserMessage,
  buildNewPackagePurchaseMessage,
  buildAppointmentReassignedMessage,
  buildErrorAlertMessage,
};