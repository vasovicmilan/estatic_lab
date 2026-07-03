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

export default {
  buildNewAppointmentMessage,
  buildAppointmentCancelledMessage,
  buildAppointmentStatusChangeMessage,
  buildNewContactMessage,
  buildNewTestimonialMessage,
  buildNewUserMessage,
};