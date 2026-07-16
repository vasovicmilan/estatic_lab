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

  const lines = [
    `📅 <b>Novi termin zakazan</b>`,
    "",
    `👤 <b>Klijent:</b> ${escapeHtml(fullName || "-")}`,
    `📧 <b>Email:</b> ${escapeHtml(appointment.email || "-")}`,
  ];
  if (appointment.phone) lines.push(`📱 <b>Telefon:</b> ${escapeHtml(appointment.phone)}`);
  lines.push(`💆 <b>Usluga:</b> ${escapeHtml(appointment.serviceName || "-")}`);
  if (appointment.duration) lines.push(`⏱ <b>Trajanje:</b> ${escapeHtml(appointment.duration)}`);
  lines.push(`🕐 <b>Termin:</b> ${escapeHtml(appointment.startTime || "-")}`);
  if (appointment.therapist) lines.push(`🧑‍⚕️ <b>Terapeut:</b> ${escapeHtml(appointment.therapist)}`);
  lines.push(`💰 <b>Cena:</b> ${formatPrice(appointment.finalPrice)} RSD`);
  if (appointment.coupon) lines.push(`🏷 <b>Kupon:</b> ${escapeHtml(appointment.coupon)}`);
  if (appointment.note) lines.push(`📝 <b>Napomena klijenta:</b> ${escapeHtml(appointment.note)}`);
  if (appointment.adminUrl) lines.push("", `🔗 <a href="${appointment.adminUrl}">Otvori u adminu</a>`);

  return lines.join("\n");
}

export function buildAppointmentCancelledMessage(appointment) {
  const base = buildNewAppointmentMessage(appointment);
  let msg = base.replace("📅 <b>Novi termin zakazan", "❌ <b>Termin otkazan");
  if (appointment.cancelledBy) msg += `\n🙋 <b>Otkazao:</b> ${escapeHtml(appointment.cancelledBy)}`;
  if (appointment.cancelReason) msg += `\n🚫 <b>Razlog:</b> ${escapeHtml(appointment.cancelReason)}`;
  return msg;
}

export function buildAppointmentStatusChangeMessage(appointment, oldStatus, newStatus) {
  const fullName = `${appointment.firstName || ""} ${appointment.lastName || ""}`.trim();

  const lines = [
    `🔄 <b>Status termina promenjen</b>`,
    "",
    `👤 <b>Klijent:</b> ${escapeHtml(fullName || "-")}`,
    `💆 <b>Usluga:</b> ${escapeHtml(appointment.serviceName || "-")}`,
    `📊 <b>Status:</b> ${escapeHtml(oldStatus)} → <b>${escapeHtml(newStatus)}</b>`,
  ];
  if (appointment.note) lines.push(`📝 <b>Napomena:</b> ${escapeHtml(appointment.note)}`);
  if (appointment.adminUrl) lines.push("", `🔗 <a href="${appointment.adminUrl}">Otvori u adminu</a>`);

  return lines.join("\n");
}

export function buildNewContactMessage(contact) {
  const lines = [
    `📩 <b>Nova kontakt poruka</b>`,
    "",
    `👤 <b>Ime:</b> ${escapeHtml(`${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "-")}`,
    `📧 <b>Email:</b> ${escapeHtml(contact.email || "-")}`,
  ];
  if (contact.phone) lines.push(`📱 <b>Telefon:</b> ${escapeHtml(contact.phone)}`);
  if (contact.topic) lines.push(`🏷 <b>Tema:</b> ${escapeHtml(contact.topic)}`);
  lines.push(`💬 <b>Poruka:</b> ${escapeHtml((contact.message || "").substring(0, 200))}`);

  return lines.join("\n");
}

export function buildNewTestimonialMessage(testimonial) {
  const lines = [
    `⭐ <b>Novi testimonijal — čeka odobrenje</b>`,
    "",
    `👤 <b>Ime:</b> ${escapeHtml(testimonial.name || "-")}`,
  ];
  if (testimonial.subject) lines.push(`💆 <b>Povodom:</b> ${escapeHtml(testimonial.subject)}`);
  lines.push(`⭐ <b>Ocena:</b> ${"★".repeat(testimonial.rating || 0)}${"☆".repeat(5 - (testimonial.rating || 0))}`);
  lines.push(`💬 <b>Komentar:</b> ${escapeHtml((testimonial.message || "").substring(0, 200))}`);

  return lines.join("\n");
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