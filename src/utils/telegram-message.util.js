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
  if (appointment.startTime) lines.push(`🕐 <b>Termin:</b> ${escapeHtml(appointment.startTime)}`);
  if (appointment.therapist) lines.push(`🧑‍⚕️ <b>Terapeut:</b> ${escapeHtml(appointment.therapist)}`);
  lines.push(`💰 <b>Cena:</b> ${formatPrice(appointment.finalPrice)} RSD`);
  if (appointment.note) lines.push(`📝 <b>Napomena:</b> ${escapeHtml(appointment.note)}`);
  if (appointment.adminUrl) lines.push("", `🔗 <a href="${appointment.adminUrl}">Otvori u adminu</a>`);

  return lines.join("\n");
}

export function buildNewOrderMessage(order) {
  const fullName = `${order.firstName || ""} ${order.lastName || ""}`.trim();

  const lines = [
    `📦 <b>Nova porudžbina potvrđena</b>`,
    "",
    `👤 <b>Klijent:</b> ${escapeHtml(fullName || "-")}`,
    `📧 <b>Email:</b> ${escapeHtml(order.email || "-")}`,
  ];
  if (order.phone) lines.push(`📱 <b>Telefon:</b> ${escapeHtml(order.phone)}`);
  if (order.items?.length) {
    lines.push(`🛒 <b>Stavke:</b>`);
    for (const item of order.items) {
      lines.push(`&nbsp;&nbsp;- ${escapeHtml(item)}`);
    }
  }
  lines.push(`💰 <b>Ukupno:</b> ${escapeHtml(order.total || "-")}`);
  if (order.coupon) lines.push(`🏷 <b>Kupon:</b> ${escapeHtml(order.coupon)}`);
  if (order.note) lines.push(`📝 <b>Napomena klijenta:</b> ${escapeHtml(order.note)}`);
  if (order.adminUrl) lines.push("", `🔗 <a href="${order.adminUrl}">Otvori u adminu</a>`);

  return lines.join("\n");
}

export function buildOrderCancelledMessage(order) {
  const base = buildNewOrderMessage(order);
  let msg = base.replace("📦 <b>Nova porudžbina potvrđena", "❌ <b>Porudžbina otkazana");
  if (order.cancelledBy) msg += `\n🙋 <b>Otkazao:</b> ${escapeHtml(order.cancelledBy)}`;
  if (order.cancelReason) msg += `\n🚫 <b>Razlog:</b> ${escapeHtml(order.cancelReason)}`;
  return msg;
}

export function buildOrderStatusChangeMessage(order, oldStatus, newStatus) {
  const fullName = `${order.firstName || ""} ${order.lastName || ""}`.trim();

  const lines = [
    `🔄 <b>Status porudžbine promenjen</b>`,
    "",
    `👤 <b>Klijent:</b> ${escapeHtml(fullName || "-")}`,
    `📊 <b>Status:</b> ${escapeHtml(oldStatus)} → <b>${escapeHtml(newStatus)}</b>`,
  ];
  lines.push(`💰 <b>Ukupno:</b> ${escapeHtml(order.total || "-")}`);
  if (order.note) lines.push(`📝 <b>Napomena:</b> ${escapeHtml(order.note)}`);
  if (order.adminUrl) lines.push("", `🔗 <a href="${order.adminUrl}">Otvori u adminu</a>`);

  return lines.join("\n");
}

export function buildStockAlertMessage({ productName, sku, variantLabel, stock, isOutOfStock, adminUrl }) {
  const lines = [
    isOutOfStock ? `🔴 <b>Proizvod je rasprodat</b>` : `🟡 <b>Nisko stanje zaliha</b>`,
    "",
    `📦 <b>Proizvod:</b> ${escapeHtml(productName)}`,
  ];
  if (sku) lines.push(`🏷 <b>SKU:</b> ${escapeHtml(sku)}`);
  lines.push(`🔧 <b>Varijanta:</b> ${escapeHtml(variantLabel)}`);
  lines.push(`📊 <b>Na stanju:</b> ${stock}`);
  if (adminUrl) lines.push("", `🔗 <a href="${adminUrl}">Ažuriraj zalihe</a>`);

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
    `⭐ <b>Novi testimonijal - čeka odobrenje</b>`,
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
  const { errorId, method, url, statusCode, env, ...rest } = context;

  const lines = [`🚨 <b>Greška na sajtu</b>`, "", escapeHtml(message)];

  if (method || url) lines.push(`📍 <b>Ruta:</b> ${escapeHtml(`${method || ""} ${url || ""}`.trim())}`);
  if (statusCode) lines.push(`🔢 <b>Status:</b> ${statusCode}`);
  if (env) lines.push(`🌍 <b>Okruženje:</b> ${escapeHtml(env)}`);
  if (errorId) lines.push(`🆔 <b>ID greške:</b> <code>${escapeHtml(errorId)}</code>`);

  const restKeys = Object.keys(rest);
  if (restKeys.length) {
    lines.push("", `<code>${escapeHtml(JSON.stringify(rest))}</code>`);
  }

  return lines.join("\n");
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
  buildNewOrderMessage,
  buildOrderCancelledMessage,
  buildOrderStatusChangeMessage,
  buildStockAlertMessage,
  buildErrorAlertMessage,
};