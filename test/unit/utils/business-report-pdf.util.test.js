import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateBusinessReportPdf } from "../../../src/utils/business-report-pdf.util.js";

function summaryFixture(overrides = {}) {
  return {
    periodKey: "2026-08-27",
    appointments: {
      total: 12,
      revenue: 45000,
      noShowRate: 8.33,
      byStatus: [
        { label: "completed", count: 10 },
        { label: "cancelled", count: 2 },
      ],
      byEmployee: [
        { label: "Jovana Maric", count: 6, value: 27000 },
        { label: "Ana Radic", count: 4, value: 18000 },
      ],
    },
    orders: {
      total: 5,
      revenue: 12000,
      avgOrderValue: 2400,
      byStatus: [{ label: "completed", count: 5 }],
      byProduct: [{ label: "Ulje za masazu", count: 3, value: 7200 }],
    },
    packages: { totalPurchased: 2, revenue: 40000 },
    commissions: { employeeEarned: 5000, employeePaid: 3000, partnerEarned: 1200, partnerPaid: 800 },
    coupons: { totalRedemptions: 3, totalDiscountGiven: 900, byCoupon: [{ label: "LETO25", count: 3, value: 900 }] },
    ...overrides,
  };
}

function emptySummaryFixture() {
  return summaryFixture({
    appointments: { total: 0, revenue: 0, noShowRate: 0, byStatus: [], byEmployee: [] },
    orders: { total: 0, revenue: 0, avgOrderValue: 0, byStatus: [], byProduct: [] },
    packages: { totalPurchased: 0, revenue: 0 },
    commissions: { employeeEarned: 0, employeePaid: 0, partnerEarned: 0, partnerPaid: 0 },
    coupons: { totalRedemptions: 0, totalDiscountGiven: 0, byCoupon: [] },
  });
}

describe("business-report-pdf.util", () => {
  it("generates a valid PDF buffer for a full report", async () => {
    const buffer = await generateBusinessReportPdf("Dnevni poslovni izveštaj", "27.08.2026 - 27.08.2026", summaryFixture());
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.slice(0, 4).toString(), "%PDF", "should start with the PDF file signature");
    assert.ok(buffer.length > 500, "a real report PDF shouldn't be a near-empty stub");
  });

  it("REGRESSION: does not throw for a period with no data at all - the same shape that broke the email template in production", async () => {
    const buffer = await generateBusinessReportPdf("Dnevni poslovni izveštaj", "28.08.2026 - 28.08.2026", emptySummaryFixture());
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.slice(0, 4).toString(), "%PDF");
  });

  it("does not throw when breakdown lists are long enough to need a page break", async () => {
    const manyEmployees = Array.from({ length: 25 }, (_, i) => ({ label: `Terapeut ${i + 1}`, count: i + 1, value: (i + 1) * 1000 }));
    const buffer = await generateBusinessReportPdf("Godišnji poslovni izveštaj", "01.01.2026 - 31.12.2026", summaryFixture({
      appointments: { ...summaryFixture().appointments, byEmployee: manyEmployees },
    }));
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 1000, "a report that needed a page break should be noticeably larger than a single-page one");
  });

  it("does not throw when no coupons were used", async () => {
    const buffer = await generateBusinessReportPdf("x", "y", summaryFixture({ coupons: { totalRedemptions: 0, totalDiscountGiven: 0, byCoupon: [] } }));
    assert.ok(Buffer.isBuffer(buffer));
  });

  it("REGRESSION: embeds a Unicode font so Serbian diacritics render correctly - pdfkit's default Helvetica uses WinAnsiEncoding, which has no š/đ/č/ć/ž (present throughout this report's own labels: 'Prosečna vrednost', 'Povraćaj novca', 'Ukupno iskorišćeno')", async () => {
    const buffer = await generateBusinessReportPdf("Dnevni poslovni izveštaj", "27.08.2026 - 27.08.2026", summaryFixture({
      appointments: { ...summaryFixture().appointments, byEmployee: [{ label: "Nikolina Đukić", count: 1, value: 1000 }] },
    }));
    const pdfText = buffer.toString("latin1");
    assert.ok(pdfText.includes("DejaVuSans"), "a real Unicode font should be embedded");
    assert.ok(!pdfText.includes("/BaseFont /Helvetica\n"), "should not fall back to pdfkit's default WinAnsiEncoding Helvetica");
  });
});
