import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import businessReportService from "../../../src/services/business-report.service.js";
import { renderTemplate } from "../../../src/services/email.service.js";
import { FEATURES } from "../../../src/config/features.config.js";
import { getReportTotals, getPackageBreakdown } from "../../../src/utils/business-report-totals.util.js";
import Appointment from "../../../src/models/appointment.model.js";
import Order from "../../../src/models/order.model.js";
import PackagePurchase from "../../../src/models/package-purchase.model.js";
import "../../../src/models/user.model.js";

/**
 * Renders the real admin-business-report.ejs template through the real
 * renderTemplate() - the exact same function email.service.js's
 * sendBusinessReportEmail calls - so this reproduces the exact render call
 * that broke in production without needing SMTP/network. See renderTemplate's
 * own doc comment in email.service.js for why this is imported directly
 * rather than re-implemented here.
 */
function renderBusinessReportEmail(periodLabel, dateRangeLabel, summary) {
  // totals / packageBreakdown are added by sendBusinessReportEmail itself - mirrored here
  // so this stays the exact render call production makes
  return renderTemplate("admin-business-report", {
    periodLabel,
    dateRangeLabel,
    ...summary,
    totals: getReportTotals(summary, FEATURES),
    packageBreakdown: getPackageBreakdown(summary.packages),
  });
}

function validAppointment(overrides = {}) {
  return {
    user: new mongoose.Types.ObjectId(),
    service: new mongoose.Types.ObjectId(),
    // finalPrice is NOT set directly - Appointment's pre("save") hook computes
    // it from variant.price - discountApplied on every create(), same as
    // production booking. Set variant.price to control what ends up as revenue.
    variant: { name: "Aroma masaza", duration: 60, price: 4500 },
    startTime: new Date(),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    status: "completed",
    contactSnapshot: { firstName: "Ana", lastName: "Anic", email: "ana@example.com", phone: { hash: "h", encrypted: "e" } },
    ...overrides,
  };
}

function validOrder(overrides = {}) {
  return {
    user: new mongoose.Types.ObjectId(),
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "marko@example.com" },
    phone: { hash: "h", encrypted: "e" },
    address: { city: "Novi Sad", postalCode: "21000", street: "s", number: "1" },
    items: [{ product: new mongoose.Types.ObjectId(), variant: new mongoose.Types.ObjectId(), title: "Ulje za masazu", variantLabel: "250ml", price: 2400, quantity: 1 }],
    subtotal: 2400,
    totalPrice: 2400,
    status: "completed",
    ...overrides,
  };
}

/**
 * REGRESSION coverage for the production incident where the scheduled
 * "daily-business-report" (and weekly/monthly/quarterly/yearly) job crashed
 * with "appointments is not defined" in admin-business-report.ejs.
 *
 * Root cause: business-report.repository.js's upsertSummary() returned a
 * hydrated Mongoose Document from findOneAndUpdate() (no .lean()). Spreading
 * a Document (`{ ...summary }`, as email.service.js's sendBusinessReportEmail
 * does) only copies the document's own enumerable properties ($__, _doc) -
 * schema fields like `appointments` live inside _doc and are silently
 * dropped, not merely undefined. Fixed by adding .lean() to upsertSummary,
 * matching findSummary/listSummaries, which were already correct.
 */
describe("business-report-jobs / business-report email template", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  it("REGRESSION: generateSummary() returns a plain object where appointments survives a spread (not a Mongoose Document)", async () => {
    const summary = await businessReportService.generateSummary("daily", new Date());

    // The precise failure mode: on a hydrated Document, {...summary}.appointments
    // is `undefined` because the key is entirely absent, not because the
    // aggregation returned nothing.
    const spread = { ...summary };
    assert.ok(Object.prototype.hasOwnProperty.call(spread, "appointments"), "appointments must survive a spread of the summary");
    assert.ok(Object.prototype.hasOwnProperty.call(spread, "orders"));
    assert.ok(Object.prototype.hasOwnProperty.call(spread, "packages"));
    assert.ok(Object.prototype.hasOwnProperty.call(spread, "commissions"));
    assert.ok(Object.prototype.hasOwnProperty.call(spread, "coupons"));
  });

  it("REGRESSION: the real email template renders without throwing for an empty period (no data at all)", async () => {
    const summary = await businessReportService.generatePreviousPeriodSummary("daily", new Date());

    const html = await renderBusinessReportEmail("Dnevni poslovni izveštaj", "27.08.2026 - 27.08.2026", summary);
    assert.ok(html.includes("Nema završenih termina u ovom periodu."));
  });

  it("renders real appointment/order data correctly (totals, breakdown rows, no crash)", async () => {
    await Appointment.create(validAppointment());
    await Order.create(validOrder());

    const summary = await businessReportService.generatePreviousPeriodSummary("daily", new Date(Date.now() + 24 * 60 * 60 * 1000));

    const html = await renderBusinessReportEmail("Dnevni poslovni izveštaj", "27.08.2026 - 27.08.2026", summary);
    // see src/views/emails/admin-business-report.ejs's statBlock() helper.
    assert.ok(
      html.includes('>Ukupno termina</span><strong style="font-size:16px;">1</strong>'),
      "1 completed appointment should count toward appointments.total"
    );
    assert.ok(
      html.includes('>Ukupno porudžbina</span><strong style="font-size:16px;">1</strong>'),
      "1 completed order should count toward orders.total"
    );
    // orders.byProduct doesn't require an assigned employee (unlike
    // appointments.byEmployee, which this fixture deliberately leaves unset) -
    // so the product title should show up in the breakdown table.
    assert.ok(html.includes("Ulje za masazu"));
    assert.ok(!html.includes("Nema završenih porudžbina u ovom periodu."));
  });

  it("works across every period type the cron jobs actually use (weekly/monthly/quarterly/yearly), not just daily", async () => {
    for (const periodType of ["weekly", "monthly", "quarterly", "yearly"]) {
      const summary = await businessReportService.generatePreviousPeriodSummary(periodType, new Date());
      await assert.doesNotReject(renderBusinessReportEmail("x", "y", summary), `${periodType} summary should render without throwing`);
    }
  });

  const TOMORROW = () => new Date(Date.now() + 24 * 60 * 60 * 1000); // "previous period" of tomorrow = today

  it("REGRESSION: appointments.revenue is the whole period's total, not just the top-10 service variants that get listed", async () => {
    // 12 different variants x 1000 each. The breakdown list is capped at 10 rows, but the total used
    // to be summed FROM that capped list, so it came out as 10000 instead of 12000.
    for (let i = 0; i < 12; i++) {
      await Appointment.create(validAppointment({ variant: { name: `Usluga ${i}`, duration: 60, price: 1000 } }));
    }

    const summary = await businessReportService.generatePreviousPeriodSummary("daily", TOMORROW());

    assert.equal(summary.appointments.revenue, 12000);
    assert.equal(summary.appointments.byService.length, 10, "the list itself stays capped");
  });

  it("packages: shows list value - discount = collected, per package, excludes cancelled sales, and does not double count redeemed sessions", async () => {
    const user = new mongoose.Types.ObjectId();
    const item = () => ({ service: new mongoose.Types.ObjectId(), servicePackageId: new mongoose.Types.ObjectId(), sessionsTotal: 6, unitPrice: 1500 });
    const base = { user, package: new mongoose.Types.ObjectId(), purchasedBy: user };

    await PackagePurchase.create({ ...base, items: [item()], originalPrice: 9000, discountApplied: 1000, pricePaid: 8000, coupon: new mongoose.Types.ObjectId() });
    await PackagePurchase.create({ ...base, items: [item()], originalPrice: 9000, discountApplied: 0, pricePaid: 9000 });
    await PackagePurchase.create({ ...base, items: [item()], originalPrice: 6000, discountApplied: 0, pricePaid: 5000, status: "cancelled" });
    // a session delivered from a package: stored with finalPrice 0 by Appointment's pre-save hook
    await Appointment.create(validAppointment({ packagePurchase: new mongoose.Types.ObjectId() }));

    const summary = await businessReportService.generatePreviousPeriodSummary("daily", TOMORROW());
    const p = summary.packages;

    assert.equal(p.totalPurchased, 2, "cancelled sale is not counted");
    assert.equal(p.grossValue, 18000);
    assert.equal(p.discountTotal, 1000);
    assert.equal(p.revenue, 17000);
    assert.equal(p.grossValue - p.discountTotal, p.revenue);
    assert.equal(p.couponPurchases, 1);
    assert.equal(p.sessionsSold, 12);
    assert.equal(p.sessionsRedeemed, 1);
    assert.equal(p.cancelledCount, 1);
    assert.equal(p.cancelledValue, 5000);
    // the Package document doesn't exist in this fixture, so the row falls back to the placeholder name
    assert.deepEqual(p.byPackage.map((r) => [r.label, r.count, r.value]), [["Obrisan paket", 2, 17000]]);
    // redeeming a package session adds no appointment revenue - the money was booked when the package was sold
    assert.equal(summary.appointments.revenue, 0);
  });

  it("the email renders the package calculation and the combined total", async () => {
    await PackagePurchase.create({
      user: new mongoose.Types.ObjectId(),
      package: new mongoose.Types.ObjectId(),
      purchasedBy: new mongoose.Types.ObjectId(),
      items: [{ service: new mongoose.Types.ObjectId(), servicePackageId: new mongoose.Types.ObjectId(), sessionsTotal: 6, unitPrice: 1500 }],
      originalPrice: 9000,
      discountApplied: 1000,
      pricePaid: 8000,
    });

    const summary = await businessReportService.generatePreviousPeriodSummary("daily", TOMORROW());
    const html = await renderBusinessReportEmail("Dnevni poslovni izveštaj", "x", summary);

    assert.ok(html.includes("Ukupan prihod"));
    assert.ok(html.includes("Vrednost po cenovniku (bruto)"));
    assert.ok(html.includes("Obrisan paket"));
  });
});
