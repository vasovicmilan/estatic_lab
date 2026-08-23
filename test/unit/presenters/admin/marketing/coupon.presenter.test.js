import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareCouponListData, prepareCouponDetailsData, prepareCouponFormData } from "../../../../../src/presenters/admin/marketing/coupon.presenter.js";

function buildMappedCoupon(overrides = {}) {
  return {
    id: "coupon-1",
    osnovno: { kod: "PETAR10", tip: "Procenat", popust: "10%", maxPopust: null, minimalnaVrednost: null, aktivnost: "Aktivan" },
    proizvodi: { aktivno: false },
    ogranicenja: { maxUpotreba: "Neograniceno", maxUpotrebaPoKorisniku: 1, trenutnoIskorisceno: 0 },
    primenljivoNaUsluge: [],
    primenljivoNaPakete: [],
    primenljivoNaProizvode: [],
    istorijaKoriscenja: [],
    partner: null,
    vremeVazenja: { pocinje: null, istice: null },
    vreme: { kreiran: "01.01.2026.", poslednjeIzmenjen: "01.01.2026." },
    ...overrides,
  };
}

describe("prepareCouponListData", () => {
  it("carries items and pagination through unmodified", () => {
    const result = { data: [buildMappedCoupon()], page: 1, totalPages: 2 };
    const view = prepareCouponListData(result, { search: "petar" });

    assert.equal(view.items.length, 1);
    assert.equal(view.pagination.totalPages, 2);
  });
});

describe("prepareCouponDetailsData - the productDiscount block", () => {
  it("shows 'Kupon ne vazi za artikle' when the product-discount block isn't enabled", () => {
    const view = prepareCouponDetailsData(buildMappedCoupon({ proizvodi: { aktivno: false } }));
    const productSection = view.sections.find((s) => s.title === "Popust za artikle (shop)");

    assert.equal(productSection.rows.length, 1);
    assert.equal(productSection.rows[0].value, "Kupon ne važi za artikle");
  });

  it("shows the product-side discount details, independent of the main services/packages block, when enabled", () => {
    const view = prepareCouponDetailsData(
      buildMappedCoupon({
        proizvodi: { aktivno: true, tip: "Procenat", popust: "15%", maxPopust: "2000 RSD", minimalnaVrednostPorudzbine: null },
      })
    );
    const productSection = view.sections.find((s) => s.title === "Popust za artikle (shop)");

    assert.equal(productSection.rows.find((r) => r.label === "Popust").value, "15%");
    assert.equal(productSection.rows.find((r) => r.label === "Maksimalan iznos popusta").value, "2000 RSD");
  });

  it("lists each applicable service/package/product name separately - three independent sections", () => {
    const view = prepareCouponDetailsData(
      buildMappedCoupon({
        primenljivoNaUsluge: [{ naziv: "Masaza" }],
        primenljivoNaPakete: [{ naziv: "3 masaze" }],
        primenljivoNaProizvode: [{ naziv: "ESMA uredjaj" }],
      })
    );

    assert.deepEqual(view.sections.find((s) => s.title === "Primenljivo na usluge").items, ["Masaza"]);
    assert.deepEqual(view.sections.find((s) => s.title === "Primenljivo na pakete").items, ["3 masaze"]);
    assert.deepEqual(view.sections.find((s) => s.title === "Primenljivo na proizvode").items, ["ESMA uredjaj"]);
  });

  it("falls back to the raw id when an applicable item has no resolved name", () => {
    const view = prepareCouponDetailsData(buildMappedCoupon({ primenljivoNaUsluge: [{ id: "svc-orphaned", naziv: null }] }));
    assert.deepEqual(view.sections.find((s) => s.title === "Primenljivo na usluge").items, ["svc-orphaned"]);
  });

  it("omits the partner section entirely for a non-referral coupon", () => {
    const view = prepareCouponDetailsData(buildMappedCoupon({ partner: null }));
    assert.ok(!view.sidebar.some((s) => s.title === "Partner"));
  });

  it("shows the referring partner's name when the coupon is tied to one", () => {
    const view = prepareCouponDetailsData(buildMappedCoupon({ partner: { imePrezime: "Petar Petrovic" } }));
    const partnerSection = view.sidebar.find((s) => s.title === "Partner");

    assert.equal(partnerSection.rows[0].value, "Petar Petrovic");
  });

  it("shows redemption history entries as label/value rows", () => {
    const view = prepareCouponDetailsData(
      buildMappedCoupon({ istorijaKoriscenja: [{ iskoriscenoU: "05.01.2026.", iznosPopusta: "500 RSD", terminId: "apt1" }] })
    );
    const historySection = view.sections.find((s) => s.title === "Istorija korišćenja");

    assert.equal(historySection.rows[0].label, "05.01.2026.");
    assert.match(historySection.rows[0].value, /500 RSD.*apt1/);
  });

  it("uses the coupon's own code as the last breadcrumb", () => {
    const view = prepareCouponDetailsData(buildMappedCoupon({ osnovno: { kod: "LETO2026", tip: "Fiksni", popust: "500 RSD" } }));
    assert.equal(view.breadcrumbs.at(-1).label, "LETO2026");
  });
});

describe("prepareCouponFormData - independent services/packages vs products blocks", () => {
  it("defaults productDiscountEnabled to false on create - restrictive by design", () => {
    const view = prepareCouponFormData();
    assert.equal(view.fields.find((f) => f.name === "productDiscountEnabled").value, false);
  });

  it("exposes discountType/discountValue (services/packages) as fields entirely separate from productDiscountType/productDiscountValue (products)", () => {
    const view = prepareCouponFormData({
      id: "c1",
      code: "TEST",
      discountType: "fixed",
      discountValue: 500,
      productDiscountType: "percentage",
      productDiscountValue: 15,
    });

    assert.equal(view.fields.find((f) => f.name === "discountType").value, "fixed");
    assert.equal(view.fields.find((f) => f.name === "discountValue").value, 500);
    assert.equal(view.fields.find((f) => f.name === "productDiscountType").value, "percentage");
    assert.equal(view.fields.find((f) => f.name === "productDiscountValue").value, 15);
  });

  it("exposes maxDiscountAmount (services/packages cap) independently of productDiscountMaxAmount (products cap)", () => {
    const view = prepareCouponFormData({ id: "c1", code: "TEST", maxDiscountAmount: 3000, productDiscountMaxAmount: 20000 });

    assert.equal(view.fields.find((f) => f.name === "maxDiscountAmount").value, 3000);
    assert.equal(view.fields.find((f) => f.name === "productDiscountMaxAmount").value, 20000);
  });

  it("normalizes mixed populated service/package/product objects and raw ids into plain id strings, independently per array", () => {
    const view = prepareCouponFormData({
      id: "c1",
      code: "TEST",
      applicableServices: [{ id: "s1" }, "s2"],
      applicablePackages: ["p1"],
      applicableProducts: [{ id: "prod1" }],
    });

    assert.deepEqual(view.fields.find((f) => f.name === "applicableServices").value, ["s1", "s2"]);
    assert.deepEqual(view.fields.find((f) => f.name === "applicablePackages").value, ["p1"]);
    assert.deepEqual(view.fields.find((f) => f.name === "applicableProducts").value, ["prod1"]);
  });

  it("normalizes a populated partner object down to just its id, with an explicit 'not a referral coupon' option", () => {
    const noPartner = prepareCouponFormData({ id: "c1", code: "TEST", partner: null });
    const withPartner = prepareCouponFormData({ id: "c1", code: "TEST", partner: { id: "partner1" } });

    assert.equal(noPartner.fields.find((f) => f.name === "partner").value, "");
    assert.equal(noPartner.fields.find((f) => f.name === "partner").options[0].label, "Nije partnerski kupon");
    assert.equal(withPartner.fields.find((f) => f.name === "partner").value, "partner1");
  });

  it("formats validFrom/validUntil dates as plain YYYY-MM-DD strings for the date input", () => {
    const view = prepareCouponFormData({ id: "c1", code: "TEST", validFrom: "2026-01-01T00:00:00.000Z", validUntil: null });

    assert.equal(view.fields.find((f) => f.name === "validFrom").value, "2026-01-01");
    assert.equal(view.fields.find((f) => f.name === "validUntil").value, "");
  });

  it("the coupon code is always required, unlike auto-generated slugs elsewhere", () => {
    const view = prepareCouponFormData();
    assert.equal(view.fields.find((f) => f.name === "code").required, true);
  });
});