import PDFDocument from "pdfkit";

const COMPANY = {
  name: "Estetik Lab wellness centar",
  address: "Maksima Gorkog 6b, 21120 Novi Sad, Republika Srbija",
  email: "estetik.lab.ns@gmail.com",
};

/**
 * Builds a PDF invoice/order-confirmation document for the given admin-shaped order
 * (the same shape mapOrderForAdminDetail produces - has korisnik/adresa/stavke/etc.)
 * and resolves to a Buffer, ready to attach to an email.
 */
export function generateOrderInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(COMPANY.name, { align: "left" });
    doc.fontSize(9).fillColor("#666").text(COMPANY.address).text(COMPANY.email);
    doc.moveDown(1.5);

    doc.fillColor("#000").fontSize(14).text(`Potvrda porudžbine #${order.id}`);
    doc.fontSize(9).fillColor("#666").text(`Datum: ${order.datum || "-"}`);
    doc.moveDown(1);

    doc.fillColor("#000").fontSize(11).text("Kupac", { underline: true });
    doc.fontSize(10).fillColor("#333");
    doc.text(order.korisnik?.ime || "-");
    if (order.korisnik?.email) doc.text(order.korisnik.email);
    if (order.korisnik?.telefon) doc.text(order.korisnik.telefon);
    if (order.adresa) {
      doc.text(`${order.adresa.ulica || ""} ${order.adresa.broj || ""}`.trim());
      doc.text(`${order.adresa.postanskiBroj || ""} ${order.adresa.grad || ""}`.trim());
    }
    doc.moveDown(1);

    doc.fillColor("#000").fontSize(11).text("Stavke", { underline: true });
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const col = { name: 50, qty: 320, price: 380, total: 460 };
    doc.fontSize(9).fillColor("#666");
    doc.text("Proizvod", col.name, tableTop);
    doc.text("Kol.", col.qty, tableTop);
    doc.text("Cena", col.price, tableTop);
    doc.text("Ukupno", col.total, tableTop);
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor("#ccc").stroke();

    let y = tableTop + 20;
    doc.fillColor("#000").fontSize(10);
    for (const item of order.stavke || []) {
      doc.text(`${item.naziv} (${item.varijanta})`, col.name, y, { width: 260 });
      doc.text(String(item.kolicina), col.qty, y);
      doc.text(String(item.cena), col.price, y);
      doc.text(String(item.ukupno), col.total, y);
      y += 20;
    }

    doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor("#ccc").stroke();
    y += 14;

    doc.fontSize(10);
    doc.text("Subtotal:", col.price, y);
    doc.text(String(order.subtotal ?? "-"), col.total, y);
    y += 16;
    doc.text("Dostava:", col.price, y);
    doc.text(String(order.dostava ?? "-"), col.total, y);
    y += 16;
    if (order.kupon) {
      doc.text("Popust:", col.price, y);
      doc.text(`-${order.popust ?? 0}`, col.total, y);
      y += 16;
    }
    doc.fontSize(11).text("Ukupno:", col.price, y, { underline: true });
    doc.text(String(order.ukupnaCena ?? "-"), col.total, y, { underline: true });

    doc.moveDown(3);
    doc.fontSize(8).fillColor("#999").text(
      "Ovo je automatski generisana potvrda porudžbine i ne predstavlja fiskalni račun.",
      50,
      doc.y,
      { width: 495 }
    );

    doc.end();
  });
}

export default { generateOrderInvoicePdf };