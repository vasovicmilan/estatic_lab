import { formatDateTime } from "../utils/date.time.util.js";
import { decryptPhone } from "../utils/phone.util.js";
import { decryptAddress } from "../utils/address.util.js";

function mapItems(items = []) {
  return items.map((item) => ({
    productId: item.product?.toString(),
    variantId: item.variant?.toString(),
    naziv: item.title,
    varijanta: item.variantLabel,
    sku: item.sku || null,
    cena: item.price,
    kolicina: item.quantity,
  }));
}

export function mapTemporaryOrdersForAdminList(orders = []) {
  return orders
    .map((order) => {
      if (!order) return null;
      return {
        id: order._id.toString(),
        korisnik: `${order.contactSnapshot?.firstName || ""} ${order.contactSnapshot?.lastName || ""}`.trim(),
        email: order.contactSnapshot?.email || null,
        ukupnaCena: order.totalPrice != null ? `${order.totalPrice.toFixed(2)} RSD` : "0 RSD",
        istice: formatDateTime(order.tokenExpiration),
        kreirano: formatDateTime(order.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapTemporaryOrderForAdminDetail(order) {
  if (!order) return null;
  const decryptedAddress = decryptAddress(order.address);

  return {
    id: order._id.toString(),
    korisnik: {
      ime: `${order.contactSnapshot?.firstName || ""} ${order.contactSnapshot?.lastName || ""}`.trim(),
      email: order.contactSnapshot?.email || null,
      telefon: decryptPhone(order.phone),
    },
    adresa: decryptedAddress
      ? {
          grad: decryptedAddress.city,
          postanskiBroj: decryptedAddress.postalCode,
          ulica: decryptedAddress.street,
          broj: decryptedAddress.number,
        }
      : null,
    stavke: mapItems(order.items),
    subtotal: order.subtotal,
    dostava: order.shipping,
    kupon: order.coupon?.code || null,
    popust: order.discountApplied || 0,
    ukupnaCena: order.totalPrice,
    napomena: order.note || null,
    token: {
      istice: formatDateTime(order.tokenExpiration),
      istekao: new Date(order.tokenExpiration) < new Date(),
    },
    vreme: {
      kreirano: formatDateTime(order.createdAt),
    },
  };
}

// feeds order.service.js's confirmOrder() - everything needed to build the real
// Order document, still in the temp order's own (encrypted phone/address) shape
export function mapTemporaryOrderForConfirmation(order) {
  if (!order) return null;
  return {
    temporaryOrderId: order._id.toString(),
    user: order.user,
    contactSnapshot: order.contactSnapshot,
    phone: order.phone,
    address: order.address,
    items: order.items,
    subtotal: order.subtotal,
    shipping: order.shipping,
    coupon: order.coupon,
    discountApplied: order.discountApplied,
    totalPrice: order.totalPrice,
    note: order.note,
  };
}

export function mapTemporaryOrderRaw(order) {
  return order;
}

export default {
  mapTemporaryOrdersForAdminList,
  mapTemporaryOrderForAdminDetail,
  mapTemporaryOrderForConfirmation,
  mapTemporaryOrderRaw,
};