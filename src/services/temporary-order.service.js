import mongoose from "mongoose";
import eventEmitter from "../events/event.emitter.js";
import tempOrderRepo from "../repositories/temporary-order.repository.js";
import userService from "./user.service.js";
import productService from "./product.service.js";
import couponService from "./coupon.service.js";
import { buildPhoneRecord } from "../utils/phone.util.js";
import { buildAddressRecord } from "../utils/address.util.js";
import { generateRandomToken } from "./crypto.service.js";
import { DEFAULT_SHIPPING_PRICE, TEMP_ORDER_TOKEN_TTL_MINUTES, TEMP_ORDER_RETENTION_HOURS } from "../config/shop.config.js";
import {
  mapTemporaryOrdersForAdminList,
  mapTemporaryOrderForAdminDetail,
  mapTemporaryOrderForConfirmation,
} from "../mappers/temporary-order.mapper.js";
import { validationError, notFound, badRequest, unauthorized } from "../utils/error.util.js";
import { logInfo, logError } from "../utils/logger.util.js";

/**
 * The core checkout flow. Reads that only inform a decision happen before the
 * transaction; the guest-user creation (if any), the per-item stock reservation, and
 * the TemporaryOrder write all happen inside one transaction; events fire only after
 * commit. Same shape as appointment.service.js's bookAppointment - see that file's
 * top comment for the reasoning this mirrors.
 */
export async function createTemporaryOrder(input) {
  const {
    items = [],
    isLoggedIn = false,
    userId = null,
    contact = {},
    phone,
    address,
    note = "",
    couponCode = null,
  } = input;

  if (!items.length) validationError("items");
  if (!contact.email) validationError("email");
  if (!contact.firstName) validationError("firstName");
  if (!phone) validationError("phone");
  if (!address?.city || !address?.street || !address?.number || !address?.postalCode) validationError("address");

  // ---- reads before the transaction ----
  // Preview price/availability so we can validate the coupon and show an accurate
  // total up front. The authoritative check-and-decrement happens again inside the
  // transaction (decreaseVariationStock) - if stock changed in between, that call
  // throws and aborts the transaction, same acceptable-race tradeoff bookAppointment
  // already makes for slot availability.
  let previewSubtotal = 0;
  for (const item of items) {
    if (!item.productId) validationError("productId");
    if (!item.variantId) validationError("variantId");
    if (!item.quantity || item.quantity <= 0) validationError("quantity");
    const { variation } = await productService.getVariationRaw(item.productId, item.variantId);
    previewSubtotal += variation.price * item.quantity;
  }

  let buyerId = null;
  let needsGuestUser = false;

  if (isLoggedIn && userId) {
    const existing = await userService.findUserById(userId);
    if (!existing) notFound("Korisnik");
    buyerId = existing._id;
  } else {
    const existing = await userService.findUserByEmail(contact.email);
    if (existing) {
      buyerId = existing._id;
    } else {
      needsGuestUser = true;
    }
  }

  let couponResult = null;
  if (couponCode) {
    couponResult = await couponService.validateCouponForOrder(couponCode, {
      userId: buyerId,
      productIds: items.map((i) => i.productId),
      orderValue: previewSubtotal,
    });
  }

  const shipping = DEFAULT_SHIPPING_PRICE;

  // ---- transaction ----
  const session = await mongoose.startSession();
  let created;
  let accountJustCreated = false;
  const orderItems = [];

  try {
    await session.withTransaction(async () => {
      if (needsGuestUser) {
        const guestUser = await userService.createGuestUser(
          { firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone },
          { session }
        );
        buyerId = guestUser._id;
        accountJustCreated = true;
      }

      let subtotal = 0;
      for (const item of items) {
        const product = await productService.decreaseVariationStock(item.productId, item.variantId, item.quantity, { session });
        const variation = product.variations.id(item.variantId);

        orderItems.push({
          product: product._id,
          variant: variation._id,
          title: product.name,
          variantLabel: variation.label,
          sku: variation.sku || product.sku,
          price: variation.price,
          quantity: item.quantity,
          image: variation.image || product.image || null,
        });
        subtotal += variation.price * item.quantity;
      }

      const discountApplied = couponResult?.discountAmount || 0;
      const verificationToken = generateRandomToken(32);
      const tokenExpiration = new Date(Date.now() + TEMP_ORDER_TOKEN_TTL_MINUTES * 60000);

      created = await tempOrderRepo.createTemporaryOrder(
        {
          user: buyerId,
          contactSnapshot: {
            firstName: contact.firstName,
            lastName: contact.lastName || "",
            email: contact.email,
          },
          phone: buildPhoneRecord(phone),
          address: buildAddressRecord(address),
          items: orderItems,
          subtotal,
          shipping,
          coupon: couponResult?.coupon._id || null,
          discountApplied,
          note,
          verificationToken,
          tokenExpiration,
        },
        { session }
      );
    });
  } catch (error) {
    logError("Checkout transaction failed", error, { itemCount: items.length });
    throw error;
  } finally {
    await session.endSession();
  }

  logInfo("Temporary order created", { temporaryOrderId: created._id, userId: String(buyerId), accountJustCreated });

  eventEmitter.emit("temporary-order:created", {
    temporaryOrderId: created._id.toString(),
    email: contact.email,
    firstName: contact.firstName,
    verificationToken: created.verificationToken,
    tokenExpiration: created.tokenExpiration,
  });

  if (accountJustCreated) {
    const guestUser = await userService.findUserById(buyerId);
    eventEmitter.emit("user:guest_created", {
      userId: buyerId,
      email: guestUser.email,
      firstName: guestUser.firstName,
      resetToken: guestUser.resetToken,
    });
  }

  return {
    id: created._id.toString(),
    verificationToken: created.verificationToken,
    tokenExpiration: created.tokenExpiration,
    totalPrice: created.totalPrice,
    accountJustCreated,
  };
}

export async function getTemporaryOrderById(orderId) {
  if (!orderId) validationError("orderId");
  const order = await tempOrderRepo.findTemporaryOrderById(orderId);
  if (!order) notFound("Privremena porudžbina");
  return mapTemporaryOrderForAdminDetail(order);
}

export async function listTemporaryOrders({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await tempOrderRepo.findTemporaryOrders({ search, limit, page, filters });
  return { data: mapTemporaryOrdersForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

/**
 * Validates a confirmation token and hands back everything order.service.js's
 * confirmOrder needs to build the real Order - does not itself create anything or
 * touch stock. `ignoreExpiration` lets an admin manually push through an order for a
 * customer who missed the window without making them re-checkout from scratch.
 */
export async function verifyToken(orderId, token, { ignoreExpiration = false } = {}) {
  if (!orderId) validationError("orderId");
  if (!token) validationError("token");

  const order = await tempOrderRepo.findTemporaryOrderById(orderId);
  if (!order) badRequest("Privremena porudžbina ne postoji");
  if (order.verificationToken !== token) unauthorized("Neispravan verifikacioni token");
  if (!ignoreExpiration && new Date(order.tokenExpiration) < new Date()) {
    badRequest("Verifikacioni token je istekao");
  }

  return mapTemporaryOrderForConfirmation(order);
}

export async function deleteTemporaryOrder(orderId, { session } = {}) {
  if (!orderId) validationError("orderId");
  const deleted = await tempOrderRepo.deleteTemporaryOrderById(orderId, { session });
  if (!deleted) notFound("Privremena porudžbina");
  return { deleted: true, id: orderId };
}

export async function getTemporaryOrderRawById(orderId) {
  if (!orderId) validationError("orderId");
  const order = await tempOrderRepo.findTemporaryOrderById(orderId);
  if (!order) notFound("Privremena porudžbina");
  return order;
}

/**
 * Releases stock for checkouts nobody confirmed within the full retention window -
 * not the moment the token expires, but TEMP_ORDER_RETENTION_HOURS after that. The
 * token itself stops working at expiration (see verifyToken above), but the record
 * sticks around much longer so a customer can still ask an admin to push it through
 * (see order.service.js's confirmOrderByAdmin) or an admin can reach out to ask if
 * they still want it. Meant to run on a schedule, not from a request. No coupon
 * release needed: coupons are only ever actually redeemed at confirm time (see
 * order.service.js), never at checkout time, so an expired temp order never held a
 * real redemption to give back.
 */
export async function cleanupExpiredTemporaryOrders() {
  const cutoff = new Date(Date.now() - TEMP_ORDER_RETENTION_HOURS * 60 * 60 * 1000);
  const expired = await tempOrderRepo.findTemporaryOrdersPastRetention(cutoff);
  let cleaned = 0;

  for (const order of expired) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of order.items) {
          await productService.restoreVariationStock(item.product, item.variant, item.quantity, { session });
        }
        await tempOrderRepo.deleteTemporaryOrderById(order._id, { session });
      });
      cleaned += 1;
    } catch (error) {
      logError("Failed to clean up expired temporary order", error, { temporaryOrderId: order._id });
    } finally {
      await session.endSession();
    }
  }

  logInfo("Expired temporary orders cleaned up", { count: cleaned, total: expired.length, retentionHours: TEMP_ORDER_RETENTION_HOURS });
  return { cleaned, total: expired.length };
}

export default {
  createTemporaryOrder,
  getTemporaryOrderById,
  listTemporaryOrders,
  verifyToken,
  deleteTemporaryOrder,
  getTemporaryOrderRawById,
  cleanupExpiredTemporaryOrders,
};