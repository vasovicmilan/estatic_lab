import { formatDateTime } from "../utils/date.time.util.js";
import { decryptPhone } from "../utils/phone.util.js";
import { decryptAddress } from "../utils/address.util.js";

export function translateStatus(status) {
  const map = {
    pending: "Na čekanju",
    processing: "U obradi",
    shipped: "Poslato",
    delivered: "Dostavljeno",
    completed: "Završeno",
    cancelled: "Otkazano",
    returned: "Vraćeno",
    refunded: "Refundirano",
  };
  return map[status] || status;
}

function translateActor(actor) {
  const map = { user: "Korisnik", admin: "Administrator" };
  return map[actor] || actor;
}

function formatImage(image) {
  if (!image) return null;
  return { url: image.img || null, alt: image.imgDesc || null };
}

function getUserName(order) {
  if (order.contactSnapshot?.firstName) {
    return `${order.contactSnapshot.firstName} ${order.contactSnapshot.lastName || ""}`.trim();
  }
  if (order.user && typeof order.user === "object") {
    return `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim();
  }
  return "Nepoznat korisnik";
}

function mapItems(items = []) {
  return items.map((item) => ({
    productId: item.product?._id?.toString() || item.product?.toString(),
    variantId: item.variant?.toString(),
    naziv: item.title,
    varijanta: item.variantLabel,
    sku: item.sku || null,
    cena: item.price,
    kolicina: item.quantity,
    ukupno: item.price * item.quantity,
    slika: formatImage(item.image),
  }));
}

function mapAddress(order) {
  const decrypted = decryptAddress(order.address);
  if (!decrypted) return null;
  return {
    grad: decrypted.city,
    postanskiBroj: decrypted.postalCode,
    ulica: decrypted.street,
    broj: decrypted.number,
  };
}

export function mapOrdersForAdminList(orders = []) {
  return orders
    .map((order) => {
      if (!order) return null;
      return {
        id: order._id.toString(),
        korisnik: getUserName(order),
        brojStavki: order.items?.length || 0,
        ukupnaCena: order.totalPrice != null ? `${order.totalPrice.toFixed(2)} RSD` : "0 RSD",
        status: translateStatus(order.status),
        statusRaw: order.status,
        datum: formatDateTime(order.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapOrderForAdminDetail(order) {
  if (!order) return null;

  return {
    id: order._id.toString(),
    korisnik: {
      ime: getUserName(order),
      email: order.contactSnapshot?.email || order.user?.email || null,
      telefon: decryptPhone(order.phone),
    },
    adresa: mapAddress(order),
    stavke: mapItems(order.items),
    subtotal: order.subtotal,
    dostava: order.shipping || 0,
    kupon: order.coupon?.code || null,
    popust: order.discountApplied || 0,
    ukupnaCena: order.totalPrice != null ? `${order.totalPrice.toFixed(2)} RSD` : null,
    napomena: order.note || null,
    status: translateStatus(order.status),
    statusRaw: order.status,
    cancelToken: order.cancelToken || null,

    otkazao: order.cancelledBy ? translateActor(order.cancelledBy) : null,
    otkazanoU: formatDateTime(order.cancelledAt),
    razlogOtkazivanja: order.cancellationReason || null,

    razlogVracanja: order.returnReason || null,

    vreme: {
      naruceno: formatDateTime(order.createdAt),
      uObradiOd: formatDateTime(order.processingAt),
      poslatoU: formatDateTime(order.shippedAt),
      dostavljenoU: formatDateTime(order.deliveredAt),
      zavrsenoU: formatDateTime(order.completedAt),
      vracenoU: formatDateTime(order.returnedAt),
      refundiranoU: formatDateTime(order.refundedAt),
    },
  };
}

export function mapOrderForUserShort(order) {
  return {
    id: order._id.toString(),
    brojStavki: order.items?.length || 0,
    ukupnaCena: order.totalPrice != null ? `${order.totalPrice.toFixed(2)} RSD` : null,
    status: translateStatus(order.status),
    statusRaw: order.status,
    datum: formatDateTime(order.createdAt),
  };
}

export function mapOrderForUserDetail(order) {
  if (!order) return null;

  return {
    id: order._id.toString(),
    adresa: mapAddress(order),
    stavke: mapItems(order.items),
    subtotal: order.subtotal,
    dostava: order.shipping || 0,
    kupon: order.coupon?.code || null,
    popust: order.discountApplied || 0,
    ukupnaCena: order.totalPrice != null ? `${order.totalPrice.toFixed(2)} RSD` : null,
    napomena: order.note || null,
    status: translateStatus(order.status),
    statusRaw: order.status,
    razlogOtkazivanja: order.cancellationReason || null,
    datum: formatDateTime(order.createdAt),
  };
}

export function mapOrdersForUser(orders = []) {
  return orders.map(mapOrderForUserShort).filter(Boolean);
}

/**
 * Dispatcher used by order.service.js - picks the right shape by who's asking,
 * same convention as mapAppointment.
 */
export function mapOrder(order, role, viewType = "short") {
  if (!order) return null;
  if (role === "admin") {
    return viewType === "short" ? mapOrdersForAdminList([order])[0] : mapOrderForAdminDetail(order);
  }
  return viewType === "short" ? mapOrderForUserShort(order) : mapOrderForUserDetail(order);
}

export default {
  translateStatus,
  mapOrdersForAdminList,
  mapOrderForAdminDetail,
  mapOrderForUserShort,
  mapOrderForUserDetail,
  mapOrdersForUser,
  mapOrder,
};