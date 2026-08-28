import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import businessReportService from "../../../src/services/business-report.service.js";
import { renderTemplate } from "../../../src/services/email.service.js";
import Appointment from "../../../src/models/appointment.model.js";
import Order from "../../../src/models/order.model.js";
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
  return renderTemplate("admin-business-report", { periodLabel, dateRangeLabel, ...summary });
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
});
