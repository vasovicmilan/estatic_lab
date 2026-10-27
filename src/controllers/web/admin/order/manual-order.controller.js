import orderService from "../../../../services/order.service.js";
import * as productService from "../../../../services/product.service.js";
import * as userService from "../../../../services/user.service.js";
import { prepareManualOrderFormData } from "../../../../presenters/admin/order/manual-order.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

/**
 * Loads everything the manual-creation form needs to build its client-side
 * cascading product -> variant picker, plus the existing-user dropdown - same
 * "load it all up front" reasoning as manual-appointment.controller.js's
 * loadFormOptions (the catalog here is small enough that this beats several
 * round-trips, unlike availability lookups which genuinely need to be live).
 */
async function loadFormOptions() {
  const [productsResult, usersResult] = await Promise.all([
    productService.listProducts({ filters: { isActive: true }, limit: 200 }),
    userService.listUsers({ status: "active", limit: 200 }),
  ]);

  // the admin LIST shape only has a price range + variant count, not the
  // actual per-variant array (see product.mapper.js's mapProductsForAdminList) -
  // each active product needs its own follow-up fetch for that, same
  // structural reason manual-appointment.controller.js does this per-service.
  const productsWithVariants = await Promise.all(productsResult.data.map((p) => productService.getProductForEdit(p.id)));

  return {
    products: productsWithVariants.map((p) => ({
      id: p.id,
      name: p.name,
      priceOnRequest: p.priceOnRequest,
      variants: (p.variations || [])
        .filter((v) => v.isActive)
        .map((v) => ({ id: v._id.toString(), name: v.label, price: v.price, stock: v.stock })),
    })),
    userOptions: usersResult.data.map((u) => ({ value: u.id, label: `${u.imePrezime} (${u.email})` })),
  };
}

/**
 * The form posts one row per product as items[0][productId], items[0][variantId], ... qs
 * hands that back as an array (or, for a sparse/high index, a plain object) - either way it
 * becomes a clean list here. An empty price field means "use the catalog price" (null).
 */
export function parseManualOrderItems(raw) {
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  return rows.map((row) => ({
    productId: row.productId,
    variantId: row.variantId,
    quantity: parseInt(row.quantity, 10),
    priceOverride: row.price !== undefined && row.price !== "" ? parseFloat(row.price) : null,
  }));
}

export async function newManualOrderForm(req, res, next) {
  try {
    const options = await loadFormOptions();
    const formData = prepareManualOrderFormData(options);
    return res.render("admin/order/manual-create", {
      pageTitle: "Nova porudžbina (ručno)",
      pageDescription: "Ručno kreiranje porudžbine - telefonska porudžbina, poklon, ili artikal sa cenom na upit",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newManualOrderForm] Greška pri prikazu forme za ručno kreiranje porudžbine", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function createManualOrder(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createManualOrder] Validacione greške pri ručnom kreiranju porudžbine", {
        validationErrors: req.validationErrors,
        userId: req.session?.user?.id,
      });
      const options = await loadFormOptions();
      const formData = prepareManualOrderFormData(options);
      return res.status(400).render("admin/order/manual-create", {
        pageTitle: "Nova porudžbina (ručno)",
        pageDescription: "Ručno kreiranje porudžbine - telefonska porudžbina, poklon, ili artikal sa cenom na upit",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const { existingUserId, firstName, lastName, email, phone, address, shipping, note, finalTotal } = req.body;

    const items = parseManualOrderItems(req.body.items);
    const parsedFinalTotal = finalTotal !== undefined && finalTotal !== "" ? parseFloat(finalTotal) : null;

    const order = await orderService.createManualOrder(
      {
        items,
        finalTotal: parsedFinalTotal,
        existingUserId: existingUserId || null,
        contact: { firstName, lastName, email },
        phone,
        address,
        shipping: shipping ? parseFloat(shipping) : 0,
        note,
      },
      { actorId: req.session?.user?.id, actorRole: req.session?.user?.role?.name || "admin" }
    );

    logInfo("[createManualOrder] Porudžbina ručno kreirana", { orderId: order.id, userId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_MANUALLY_CREATED",
      entity: { type: "Order", id: order.id },
      changes: {
        items: { old: null, new: items.map((i) => `${i.productId}/${i.variantId} x${i.quantity}${i.priceOverride != null ? ` @${i.priceOverride}` : ""}`).join(", ") },
        finalTotal: { old: null, new: parsedFinalTotal },
      },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Porudžbina je uspešno kreirana.", `/admin/porudzbine/detalji/${order.id}`);
  } catch (error) {
    logError("[createManualOrder] Greška pri ručnom kreiranju porudžbine", error, { userId: req.session?.user?.id, body: req.body });
    if (error.statusCode) {
      const options = await loadFormOptions();
      const formData = prepareManualOrderFormData(options);
      return res.status(error.statusCode).render("admin/order/manual-create", {
        pageTitle: "Nova porudžbina (ručno)",
        pageDescription: "Ručno kreiranje porudžbine - telefonska porudžbina, poklon, ili artikal sa cenom na upit",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export default { newManualOrderForm, createManualOrder };
