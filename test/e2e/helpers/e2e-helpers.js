import { expect } from "@playwright/test";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../../../src/models/user.model.js";
import Role from "../../../src/models/role.model.js";
import Product from "../../../src/models/product.model.js";
import TemporaryOrder from "../../../src/models/temporary-order.model.js";
import Partner from "../../../src/models/partner.model.js";
import Coupon from "../../../src/models/coupon.model.js";
import CommissionEntry from "../../../src/models/commission-entry.model.js";
import Order from "../../../src/models/order.model.js";
import Service from "../../../src/models/service.model.js";
import Package from "../../../src/models/package.model.js";
import Employee from "../../../src/models/employee.model.js";
import Appointment from "../../../src/models/appointment.model.js";
import { buildPhoneRecord } from "../../../src/utils/phone.util.js";
import { buildAddressRecord } from "../../../src/utils/address.util.js";
import { getZonedComponents } from "../../../src/utils/date.time.util.js";

const PASSWORD = "lozinka123";

/**
 * Accepts the cookie-consent banner (see includes/components/cookie-consent.ejs)
 * if it's showing. Best-effort and non-blocking: the banner is a bottom-pinned
 * strip with no full-page backdrop, so it doesn't actually intercept clicks on
 * form fields further up the page - but leaving it undismissed is still bad
 * practice (screenshots/traces get cluttered, and any future redesign that adds a
 * backdrop would silently break every spec that didn't already handle this).
 */
export async function dismissCookieConsent(page) {
  const acceptButton = page.locator("[data-cookie-consent-accept]");
  try {
    await acceptButton.click({ timeout: 3_000 });
  } catch {
    // banner wasn't shown (e.g. cookie already set from an earlier goto on this
    // same page) - nothing to do
  }
}

/**
 * Registers a brand-new account through the real /registracija form, then
 * force-activates it directly in the DB (registration leaves a new account in
 * "pending" status awaiting email confirmation - see auth.service.js's login guard -
 * and E2E has no mailbox to click a real confirmation link from) before logging in
 * through the real /prijava form. Both form submissions go through the actual
 * browser, so CSRF/session-cookie handling is exercised exactly as a real visitor
 * would hit it - only the email-confirmation step is short-circuited.
 */
export async function registerAndLoginViaUI(page, { email, firstName = "Test", lastName = "Korisnik" }) {
  await page.goto("/registracija");
  await dismissCookieConsent(page);
  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.fill('input[name="passwordConfirm"]', PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForLoadState("networkidle");
  await User.updateOne({ email }, { status: "active", confirmed: true });

  await page.goto("/prijava");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * Logs into an ALREADY-EXISTING account - for users seeded directly via the model
 * (seedEmployee, seedPartner), which never went through /registracija at all. Using
 * registerAndLoginViaUI on one of those would try to create a second account with
 * the same email and fail on the duplicate-email check; this is the login-only half
 * of that helper.
 */
export async function loginViaUI(page, { email, password = PASSWORD }) {
  await page.goto("/prijava");
  await dismissCookieConsent(page);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * Elevates an already-registered/logged-in user straight to the "admin" role via a
 * direct DB write, then reloads the page so the session (JWT carries the role id
 * baked in at login - see auth.service.js) picks up the change. Bypassing the UI
 * here is deliberate: promoting a user to admin has no self-service UI path (an
 * existing admin has to do it), and re-registering a second account specifically as
 * an admin from scratch would just be exercising the same registration flow twice
 * for no additional coverage.
 */
export async function promoteToAdmin(page, email) {
  const adminRole = await Role.findOne({ name: "admin" });
  if (!adminRole) throw new Error("'admin' role not found - was seedRoles() run by start-server.js?");
  await User.updateOne({ email }, { role: adminRole._id });

  // the session's role snapshot was taken at login (see auth.service.js's login) -
  // logging back in is what actually picks up the new role. The user is still
  // logged in from registerAndLoginViaUI at this point, and loginForm redirects an
  // already-logged-in session straight to "/" without ever rendering the form (see
  // auth.controller.js) - so a real logout has to happen first, or /prijava would
  // silently 302 to the homepage and every subsequent selector wait would hang
  // against whatever happens to be on that page instead.
  await page.goto("/odjava");
  await page.goto("/prijava");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

let productCounter = 0;

/**
 * Seeds a purchasable product with a single active, in-stock variation - directly
 * via the model, not through the admin product-creation wizard (that's a separate
 * multi-step flow with its own coverage concerns; these specs are about what
 * happens to an *existing* freight-class product at checkout, not about how admins
 * create one). `shippingClass: "freight"` is the one field that actually matters for
 * these tests - see product.model.js.
 */
export async function seedProduct({ shippingClass = "standard", price = 1000, stock = 10 } = {}) {
  productCounter += 1;
  const suffix = `${Date.now()}-${productCounter}`;
  const product = await Product.create({
    name: `E2E Test Proizvod ${suffix}`,
    slug: `e2e-test-proizvod-${suffix}`,
    sku: `E2E-${suffix}`,
    shortDescription: "Test proizvod za E2E scenario.",
    shippingClass,
    isActive: true,
    // required for a published product - see product.model.js's
    // validatePublishInvariants. Points at a placeholder path, not a real uploaded
    // file - fine here since the product-detail page only renders the URL string,
    // it never reads the file from disk during these tests.
    image: { img: "/images/products/e2e-placeholder.webp", imgDesc: "E2E test placeholder slika" },
    variations: [
      {
        label: "Standard",
        price,
        stock,
        isActive: true,
      },
    ],
  });
  return product;
}

/**
 * Finds the most recently created TemporaryOrder for a given checkout email and
 * returns its confirmation URL - the same {orderId, token} pair that would
 * otherwise only exist inside an email a real customer receives (see
 * order.service.js's confirmOrder route, `/korpa/potvrda/:orderId/:token`).
 * E2E has no mailbox to read that link from, so this reads it directly out of the
 * database instead - the actual page navigation and confirmation still goes
 * through the real route exactly as clicking the email link would.
 */
export async function getOrderConfirmationUrl(email) {
  const tempOrder = await TemporaryOrder.findOne({ "contactSnapshot.email": email }).sort({ createdAt: -1 });
  if (!tempOrder) throw new Error(`No TemporaryOrder found for ${email}`);
  return `/korpa/potvrda/${tempOrder._id.toString()}/${tempOrder.verificationToken}`;
}

export async function findTemporaryOrderByEmail(email) {
  return TemporaryOrder.findOne({ "contactSnapshot.email": email }).sort({ createdAt: -1 });
}

export async function seedPartner({
  commissionRateServices = 10,
  commissionRateProducts = 3,
  maxCommissionAmountServices = null,
  maxCommissionAmountProducts = null,
} = {}) {
  const partnerRole = await Role.findOne({ name: "partner" });
  if (!partnerRole) throw new Error("'partner' role not found - was seedRoles() run by start-server.js?");

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const user = await User.create({
    firstName: "E2E",
    lastName: "Partner",
    email: `e2e-partner-${suffix}@example.com`,
    password: await bcrypt.hash(PASSWORD, 12),
    role: partnerRole._id,
    status: "active",
    confirmed: true,
  });

  const partner = await Partner.create({
    userId: user._id,
    commissionRateServices,
    commissionRateProducts,
    maxCommissionAmountServices,
    maxCommissionAmountProducts,
    isActive: true,
  });

  return { user, partner };
}

let couponCounter = 0;

export async function seedCoupon({
  discountType = "percentage",
  discountValue = 10,
  productDiscount = null,
  partner = null,
} = {}) {
  couponCounter += 1;
  const code = `E2ETEST${Date.now()}${couponCounter}`;
  return Coupon.create({
    code,
    discountType,
    discountValue,
    productDiscount,
    partner: partner?._id || null,
    isActive: true,
  });
}

export async function findOrderByEmail(email) {
  return Order.findOne({ "contactSnapshot.email": email }).sort({ createdAt: -1 });
}

export async function findCommissionEntriesForOrder(orderId) {
  return CommissionEntry.find({ order: orderId }).lean();
}

let serviceCounter = 0;

/**
 * Seeds a bookable Service with one active variant (see
 * service.model.js's validatePublishInvariants - a published service needs both an
 * image and at least one package/variant, same shape as seedProduct's product
 * requirements). `duration` in minutes drives slot generation
 * (availability.service.js); kept short so a single seeded employee's working
 * hours can fit many slots without needing a wider window.
 */
export async function seedService({ price = 3000, duration = 30 } = {}) {
  serviceCounter += 1;
  const suffix = `${Date.now()}-${serviceCounter}`;
  const service = await Service.create({
    name: `E2E Test Usluga ${suffix}`,
    slug: `e2e-test-usluga-${suffix}`,
    shortDescription: "Test usluga za E2E scenario.",
    image: { img: "/images/services/e2e-placeholder.webp", imgDesc: "E2E test placeholder slika" },
    isActive: true,
    packages: [
      {
        name: "Standard",
        slug: "standard",
        sessions: 1,
        duration,
        totalPrice: price,
      },
    ],
  });
  return service;
}

/**
 * Seeds a commission-based employee who can perform the given service, working
 * every day of the week from midnight to 23:59 - deliberately maximal working
 * hours so availability.service.js's slot generation can never come up empty
 * regardless of which real-world weekday/time the test suite happens to run at.
 */
export async function seedEmployee({ service, commissionRate = 20, workingHours = null } = {}) {
  const employeeRole = await Role.findOne({ name: "employee" });
  if (!employeeRole) throw new Error("'employee' role not found - was seedRoles() run by start-server.js?");

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const user = await User.create({
    firstName: "E2E",
    lastName: "Terapeut",
    email: `e2e-employee-${suffix}@example.com`,
    password: await bcrypt.hash(PASSWORD, 12),
    role: employeeRole._id,
    status: "active",
    confirmed: true,
  });

  const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const employee = await Employee.create({
    userId: user._id,
    services: service ? [service._id] : [],
    // default: works every day, all day - maximal availability so slot generation
    // never comes up empty in specs that aren't specifically testing working hours
    // themselves (see booking-appointment-commission.spec.js). Pass an explicit
    // array (even []) to control this directly - working-hours.spec.js does.
    workingHours: workingHours ?? allDays.map((day) => ({ day, slots: [{ from: "00:00", to: "23:59" }] })),
    payType: "commission",
    commissionRate,
    isActive: true,
  });

  return { user, employee };
}

export async function findAppointmentByEmail(email) {
  return Appointment.findOne({ "contactSnapshot.email": email }).sort({ createdAt: -1 });
}

export async function findCommissionEntriesForAppointment(appointmentId) {
  return CommissionEntry.find({ appointment: appointmentId }).lean();
}

export async function expectFlashSuccess(page) {
  return expect(page.locator(".alert-success")).toBeVisible();
}

/**
 * Confirms the custom Bootstrap "are you sure?" modal (see main.js's
 * `data-confirm` handling around #confirmActionModal) that intercepts any form
 * carrying a `data-confirm` attribute - not a native browser dialog, so
 * Playwright's `page.on("dialog", ...)` never fires for it. Call this right after
 * clicking a submit button on a `data-confirm` form; the click only opens the
 * modal, this is what actually submits it.
 */
export async function confirmActionModal(page) {
  await page.locator("#confirmActionButton").click();
}

let customerCounter = 0;

/**
 * Seeds a plain customer account directly (no UI registration needed unless the
 * spec actually logs in as them - some specs just need a valid `user` ref to
 * attach an appointment/order to).
 */
/**
 * Fills the checkout form's phone + address fields with fixed test values -
 * repeated identically across checkout-freight-shipping.spec.js and
 * coupon-product-discount.spec.js before this was pulled out. Neither the
 * specific values nor the address itself matter to any of those tests; only that
 * the required fields are filled so the form can actually submit.
 */
export async function fillCheckoutContactAndAddress(page) {
  await page.fill("#checkout-phone", "0601234567");
  await page.fill("#addr-street", "Bulevar Oslobođenja");
  await page.fill("#addr-number", "10");
  await page.fill("#addr-city", "Novi Sad");
  await page.fill("#addr-postalCode", "21000");
}

export async function seedCustomer({ email } = {}) {
  customerCounter += 1;
  const userRole = await Role.findOne({ name: "user" });
  if (!userRole) throw new Error("'user' role not found - was seedRoles() run by start-server.js?");

  return User.create({
    firstName: "E2E",
    lastName: "Klijent",
    email: email || `e2e-customer-${Date.now()}-${customerCounter}@example.com`,
    password: await bcrypt.hash(PASSWORD, 12),
    role: userRole._id,
    status: "active",
    confirmed: true,
  });
}

/**
 * Seeds an Appointment directly, bypassing the booking UI - for specs whose actual
 * subject is what happens to an EXISTING appointment (employee/admin managing it),
 * not the booking flow itself (already covered by booking-appointment-commission.spec.js).
 * `variant` is snapshotted from the service's first package, same as
 * appointment.service.js's bookAppointment does at real booking time.
 */
export async function seedAppointment({
  service,
  employeeRecord,
  employeeUser,
  status = "pending",
  coupon = null,
  customer = null,
  daysAhead = 1,
} = {}) {
  const owner = customer || (await seedCustomer());
  const variant = service.packages[0];
  const startTime = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + variant.duration * 60000);

  return Appointment.create({
    user: owner._id,
    service: service._id,
    variant: {
      servicePackageId: variant._id,
      name: variant.name,
      duration: variant.duration,
      price: variant.totalPrice,
    },
    employee: employeeRecord?._id || null,
    employeeSnapshot: employeeUser ? { name: `${employeeUser.firstName} ${employeeUser.lastName}` } : undefined,
    startTime,
    endTime,
    status,
    finalPrice: variant.totalPrice,
    coupon: coupon?._id || null,
    contactSnapshot: { firstName: owner.firstName, lastName: owner.lastName, email: owner.email },
  });
}

/**
 * Seeds an Order directly (bypassing checkout, already covered end to end by
 * checkout-freight-shipping.spec.js / coupon-product-discount.spec.js) - for specs
 * about what happens to an EXISTING order (a customer viewing/cancelling their own).
 * Uses the real buildPhoneRecord/buildAddressRecord (encrypted+hashed, same as the
 * real checkout flow) rather than placeholder strings, since the order-details page
 * decrypts and displays them - a fake unencrypted value would break that render.
 */
export async function seedOrder({ customer, status = "pending", subtotal = 3000, coupon = null, discountApplied = 0, product = null, quantity = 1 } = {}) {
  const cancelToken = crypto.randomBytes(24).toString("hex");
  return Order.create({
    user: customer._id,
    contactSnapshot: { firstName: customer.firstName, lastName: customer.lastName, email: customer.email },
    phone: buildPhoneRecord("0601234567"),
    address: buildAddressRecord({ city: "Novi Sad", street: "Bulevar Oslobođenja", number: "10", postalCode: "21000" }),
    items: [
      {
        // defaults to a fake ObjectId (no real Product behind it) for specs that
        // only care about the Order document itself - pass a real seedProduct()
        // result when the spec needs restoreVariationStock's effect to be
        // observable (see order-cancellation.spec.js)
        product: product?._id || new mongoose.Types.ObjectId(),
        variant: product?.variations?.[0]?._id || new mongoose.Types.ObjectId(),
        title: product?.name || "E2E Test Proizvod",
        variantLabel: "Standard",
        price: subtotal,
        quantity,
      },
    ],
    subtotal,
    shipping: 0,
    discountApplied,
    coupon: coupon?._id || null,
    status,
    cancelToken,
  });
}

/**
 * Seeds an already-"earned" CommissionEntry directly - for specs about the payout
 * cycle itself (request -> approve -> mark paid), which needs a positive balance to
 * exist but isn't testing HOW that balance was earned (booking-appointment-commission.spec.js
 * and coupon-product-discount.spec.js already cover that end to end).
 */
export async function seedCommissionEntry({
  earnerType,
  employee = null,
  partner = null,
  order = null,
  sourceType = "appointment",
  status = "earned",
  amount = 1000,
  rate = 20,
} = {}) {
  return CommissionEntry.create({
    earnerType,
    employee: employee?._id || null,
    partner: partner?._id || null,
    order: order?._id || null,
    sourceType,
    baseValue: Math.round((amount * 100) / rate),
    rate,
    amount,
    status,
    earnedAt: status === "earned" ? new Date() : undefined,
  });
}

/**
 * "Tomorrow", as a single Belgrade-zoned {iso, weekday} pair computed from the SAME
 * source. Deriving the URL's `?date=` query param via native Date.toISOString()
 * (UTC) while deriving the weekday via getZonedComponents (Belgrade) - two
 * different timezone bases - can disagree near midnight: UTC's calendar day can
 * already be a day ahead of (or behind) Belgrade's, so the two independently-computed
 * values could end up describing two DIFFERENT actual calendar days. Anchoring the
 * "add a day" math to Belgrade noon (nowhere near either day boundary) and reading
 * both the date and the weekday back off that same instant avoids the mismatch
 * entirely, rather than being right only outside a narrow midnight window.
 */
export function tomorrowInBelgrade() {
  const now = getZonedComponents(new Date());
  const todayBelgradeNoon = new Date(Date.UTC(now.year, now.month - 1, now.day, 12, 0, 0));
  const tomorrow = getZonedComponents(new Date(todayBelgradeNoon.getTime() + 24 * 60 * 60 * 1000));
  return {
    iso: `${tomorrow.year}-${String(tomorrow.month).padStart(2, "0")}-${String(tomorrow.day).padStart(2, "0")}`,
    weekday: tomorrow.weekday,
  };
}

/**
 * Drives the real admin-schedule.js widget (see that file) rather than trying to
 * set its hidden `input[name="workingHours"]` directly - the widget's own
 * `form.addEventListener("submit", () => sync(container))` re-serializes ITS
 * current UI state into that hidden field right before the real submit fires,
 * silently overwriting any value set by other means. Clears out any existing slot
 * rows for the day first (each click's own `input`/`change` event keeps the hidden
 * field in sync automatically, same as a real user would trigger).
 */
export async function setEmployeeWorkingHoursViaUI(page, day, slots) {
  const dayEl = page.locator(`[data-schedule-day="${day}"]`);
  while ((await dayEl.locator("[data-schedule-slot]").count()) > 0) {
    await dayEl.locator("[data-schedule-remove-slot]").first().click();
  }
  for (const slot of slots) {
    await dayEl.locator("[data-schedule-add-slot]").click();
    const newRow = dayEl.locator("[data-schedule-slot]").last();
    await newRow.locator("[data-schedule-from]").fill(slot.from);
    await newRow.locator("[data-schedule-to]").fill(slot.to);
  }
}

let packageCounter = 0;

/**
 * Seeds a Package bundling sessions of an existing service - `service` must come
 * from seedService(), since Package.items references a real Service and one of
 * its packages[]._id (servicePackageId), the same variant a customer would book
 * a la carte. `totalPrice` is deliberately below `sessions * a-la-carte price`,
 * matching the real-world reason packages exist (bulk discount) - not asserted
 * directly by these specs, just realistic.
 */
export async function seedPackage({ service, sessions = 3, totalPrice = 6000 } = {}) {
  packageCounter += 1;
  const suffix = `${Date.now()}-${packageCounter}`;
  const variant = service.packages[0];
  return Package.create({
    name: `E2E Test Paket ${suffix}`,
    slug: `e2e-test-paket-${suffix}`,
    description: "Test paket za E2E scenario.",
    items: [{ service: service._id, servicePackageId: variant._id, sessions }],
    totalPrice,
    isActive: true,
  });
}