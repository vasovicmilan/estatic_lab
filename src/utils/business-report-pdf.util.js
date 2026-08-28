import PDFDocument from "pdfkit";
import { formatMoney } from "./price.util.js";

const COMPANY = {
  name: "Estetik Lab wellness centar",
  address: "Maksima Gorkog 6b, 21120 Novi Sad, Republika Srbija",
  email: "estetik.lab.ns@gmail.com",
};

// Same labels as admin-business-report.ejs's statusLabels - kept as a separate
// copy rather than a shared import since the email template's version lives
// inline in an EJS scriptlet, not its own module; duplicating one small map
// is simpler than extracting a shared one for a single other consumer.
const STATUS_LABELS = {
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
  completed: "Završeno",
  cancelled: "Otkazano",
  rejected: "Odbijeno",
  no_show: "Nije se pojavio/la",
  processing: "U obradi",
  shipped: "Poslato",
  delivered: "Dostavljeno",
  returned: "Vraćeno",
  refunded: "Povraćaj novca",
};

const PAGE = { left: 50, right: 545, width: 495 };
const MIN_BOTTOM_MARGIN = 90; // leave room before the page's bottom edge before starting a new block

function statusSummary(byStatus) {
  return (byStatus || []).map((s) => `${STATUS_LABELS[s.label] || s.label}: ${s.count}`).join(", ") || "Nema podataka";
}

/**
 * Builds a PDF version of the business report and resolves to a Buffer, ready
 * to attach to an email or send as an admin download - same shape/promise
 * pattern as generateOrderInvoicePdf below, and the same section layout and
 * numbers as admin-business-report.ejs (email HTML), just laid out for print
 * instead of an inbox.
 */
export function generateBusinessReportPdf(periodLabel, dateRangeLabel, summary) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    function ensureSpace(neededHeight) {
      if (doc.y + neededHeight > doc.page.height - MIN_BOTTOM_MARGIN) {
        doc.addPage();
      }
    }

    function sectionHeading(text) {
      ensureSpace(40);
      doc.moveDown(0.8);
      doc.fontSize(13).fillColor("#000").font("Helvetica-Bold").text(text);
      doc.moveDown(0.3);
      doc.font("Helvetica");
    }

    // A simple two-column label/value line - the PDF equivalent of the email
    // template's statBlock() table cells, just stacked instead of gridded
    // (pdfkit has no HTML-table layout, and a stacked list stays legible at
    // any number of stats without needing fixed column math).
    function statLine(label, value) {
      ensureSpace(18);
      doc.fontSize(9).fillColor("#666").text(label, PAGE.left, doc.y, { continued: false });
      doc.fontSize(11).fillColor("#000").text(String(value), PAGE.left, doc.y);
      doc.moveDown(0.4);
    }

    function breakdownTable(items, emptyText, showValue) {
      ensureSpace(30);
      if (!items || items.length === 0) {
        doc.fontSize(9).fillColor("#999").text(emptyText);
        doc.moveDown(0.5);
        return;
      }

      const col = { label: PAGE.left, count: 380, value: 460 };
      ensureSpace(16);
      doc.fontSize(8).fillColor("#666");
      doc.text("Stavka", col.label, doc.y, { continued: true, width: col.count - col.label });
      doc.text("Broj", col.count, doc.y, { continued: true, width: col.value - col.count });
      if (showValue) doc.text("Vrednost", col.value, doc.y);
      else doc.text("");
      doc.moveTo(PAGE.left, doc.y + 2).lineTo(PAGE.right, doc.y + 2).strokeColor("#ccc").stroke();
      doc.moveDown(0.4);

      doc.fontSize(9).fillColor("#000");
      items.forEach((item) => {
        ensureSpace(16);
        const rowY = doc.y;
        doc.text(item.label, col.label, rowY, { width: col.count - col.label - 10 });
        doc.text(String(item.count), col.count, rowY, { width: col.value - col.count - 10 });
        if (showValue) doc.text(formatMoney(item.value), col.value, rowY, { width: PAGE.right - col.value });
        doc.moveDown(0.35);
      });
      doc.moveDown(0.3);
    }

    // ---- Header ----
    doc.fontSize(18).fillColor("#000").font("Helvetica-Bold").text(COMPANY.name);
    doc.font("Helvetica").fontSize(9).fillColor("#666").text(COMPANY.address).text(COMPANY.email);
    doc.moveDown(1.2);

    doc.fillColor("#000").fontSize(15).font("Helvetica-Bold").text(periodLabel);
    doc.font("Helvetica").fontSize(9).fillColor("#666").text(`Period: ${dateRangeLabel}`);
    doc.moveDown(0.5);

    const { appointments, orders, packages, commissions, coupons } = summary;

    // ---- Zakazivanja ----
    sectionHeading("Zakazivanja");
    statLine("Ukupno termina", appointments.total);
    statLine("Prihod od termina", formatMoney(appointments.revenue));
    statLine("Stopa ne-pojavljivanja", `${appointments.noShowRate}%`);
    statLine("Po statusu", statusSummary(appointments.byStatus));
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text("Po zaposlenom");
    doc.font("Helvetica");
    breakdownTable(appointments.byEmployee, "Nema završenih termina u ovom periodu.", true);

    // ---- Prodavnica ----
    sectionHeading("Prodavnica");
    statLine("Ukupno porudžbina", orders.total);
    statLine("Prihod od porudžbina", formatMoney(orders.revenue));
    statLine("Prosečna vrednost porudžbine", formatMoney(orders.avgOrderValue));
    statLine("Po statusu", statusSummary(orders.byStatus));
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text("Po proizvodu");
    doc.font("Helvetica");
    breakdownTable(orders.byProduct, "Nema završenih porudžbina u ovom periodu.", true);

    // ---- Paketi ----
    sectionHeading("Paketi");
    statLine("Prodato paketa", packages.totalPurchased);
    statLine("Prihod od paketa", formatMoney(packages.revenue));

    // ---- Provizije ----
    sectionHeading("Provizije");
    statLine("Zaposleni - zarađeno", formatMoney(commissions.employeeEarned));
    statLine("Zaposleni - isplaćeno", formatMoney(commissions.employeePaid));
    statLine("Partneri - zarađeno", formatMoney(commissions.partnerEarned));
    statLine("Partneri - isplaćeno", formatMoney(commissions.partnerPaid));

    // ---- Kuponi ----
    sectionHeading("Kuponi");
    statLine("Ukupno iskorišćeno", coupons.totalRedemptions);
    statLine("Ukupan dat popust", formatMoney(coupons.totalDiscountGiven));
    breakdownTable(coupons.byCoupon, "Nijedan kupon nije iskorišćen u ovom periodu.", true);

    doc.moveDown(1.5);
    ensureSpace(24);
    doc.fontSize(8).fillColor("#999").text(
      `Automatski generisan izveštaj - ${new Date().toLocaleString("sr-RS")}.`,
      PAGE.left,
      doc.y,
      { width: PAGE.width }
    );

    doc.end();
  });
}

export default { generateBusinessReportPdf };
