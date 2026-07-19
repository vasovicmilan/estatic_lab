import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  translateStatus,
  mapOrdersForAdminList,
  mapOrderForAdminDetail,
  mapOrderForUserShort,
  mapOrderForUserDetail,
  mapOrder,
} from "../../../src/mappers/order.mapper.js";
import { buildAddressRecord } from "../../../src/utils/address.util.js";
import { buildOrder, buildOrderItem, id } from "../../helpers/factories.js";

describe("order.mapper", () => {
  describe("translateStatus", () => {
    it("translates every known status to Serbian", () => {
      assert.equal(translateStatus("pending"), "Na čekanju");
      assert.equal(translateStatus("processing"), "U obradi");
      assert.equal(translateStatus("shipped"), "Poslato");
      assert.equal(translateStatus("delivered"), "Dostavljeno");
      assert.equal(translateStatus("completed"), "Završeno");
      assert.equal(translateStatus("cancelled"), "Otkazano");
      assert.equal(translateStatus("returned"), "Vraćeno");
      assert.equal(translateStatus("refunded"), "Refundirano");
    });

    it("falls back to the raw value for an unknown status instead of showing 'undefined'", () => {
      assert.equal(translateStatus("something-new"), "something-new");
    });
  });

  describe("item math", () => {
    it("computes ukupno as price * quantity per line item", () => {
      const order = buildOrder({ items: [buildOrderItem({ price: 1500, quantity: 3 })] });
      const mapped = mapOrderForUserDetail(order);
      assert.equal(mapped.stavke[0].ukupno, 4500);
    });

    it("formats ukupnaCena with two decimal places and RSD suffix", () => {
      const order = buildOrder({ totalPrice: 2350 });
      const mapped = mapOrderForUserDetail(order);
      assert.equal(mapped.ukupnaCena, "2350.00 RSD");
    });

    it("shows null for ukupnaCena rather than crashing when totalPrice is missing", () => {
      const order = buildOrder({ totalPrice: undefined });
      const mapped = mapOrderForUserDetail(order);
      assert.equal(mapped.ukupnaCena, null);
    });
  });

  describe("address decryption", () => {
    it("decrypts a genuinely encrypted address back to its original plain values", () => {
      const encrypted = buildAddressRecord({ city: "Novi Sad", postalCode: "21000", street: "Bulevar Oslobođenja", number: "10" });
      const order = buildOrder({ address: encrypted });
      const mapped = mapOrderForAdminDetail(order);

      assert.equal(mapped.adresa.grad, "Novi Sad");
      assert.equal(mapped.adresa.postanskiBroj, "21000");
      assert.equal(mapped.adresa.ulica, "Bulevar Oslobođenja");
      assert.equal(mapped.adresa.broj, "10");
    });

    it("returns null for adresa rather than throwing when the address is missing/malformed", () => {
      const order = buildOrder({ address: null });
      const mapped = mapOrderForAdminDetail(order);
      assert.equal(mapped.adresa, null);
    });
  });

  describe("cancellation actor", () => {
    it("translates 'user' and 'admin' cancelledBy to Serbian, and exposes the raw value alongside", () => {
      const userCancelled = buildOrder({ cancelledBy: "user" });
      const adminCancelled = buildOrder({ cancelledBy: "admin" });

      assert.equal(mapOrderForAdminDetail(userCancelled).otkazao, "Korisnik");
      assert.equal(mapOrderForAdminDetail(userCancelled).otkazaoRaw, "user");
      assert.equal(mapOrderForAdminDetail(adminCancelled).otkazao, "Administrator");
      assert.equal(mapOrderForAdminDetail(adminCancelled).otkazaoRaw, "admin");
    });

    it("is null when the order was never cancelled", () => {
      const order = buildOrder({ cancelledBy: null });
      const mapped = mapOrderForAdminDetail(order);
      assert.equal(mapped.otkazao, null);
      assert.equal(mapped.otkazaoRaw, null);
    });
  });

  describe("customer name resolution", () => {
    it("prefers the order's own contactSnapshot over the linked User document", () => {
      const order = buildOrder({
        contactSnapshot: { firstName: "Snapshot", lastName: "Ime", email: "x@example.com" },
        user: { firstName: "Nalog", lastName: "Ime" },
      });
      const mapped = mapOrderForAdminDetail(order);
      assert.equal(mapped.korisnik.ime, "Snapshot Ime");
    });

    it("falls back to the populated User's name when there's no contactSnapshot", () => {
      const order = buildOrder({ contactSnapshot: {}, user: { firstName: "Nalog", lastName: "Ime" } });
      const mapped = mapOrderForAdminDetail(order);
      assert.equal(mapped.korisnik.ime, "Nalog Ime");
    });
  });

  describe("mapOrdersForAdminList", () => {
    it("filters out null entries", () => {
      const result = mapOrdersForAdminList([buildOrder(), null, undefined]);
      assert.equal(result.length, 1);
    });

    it("includes both status and statusRaw, so admin UI logic can branch on the untranslated value", () => {
      const order = buildOrder({ status: "shipped" });
      const [mapped] = mapOrdersForAdminList([order]);
      assert.equal(mapped.status, "Poslato");
      assert.equal(mapped.statusRaw, "shipped");
    });
  });

  describe("mapOrder dispatcher", () => {
    it("returns the admin list shape for role=admin, viewType=short", () => {
      const order = buildOrder();
      const mapped = mapOrder(order, "admin", "short");
      assert.ok("korisnik" in mapped, "admin short shape should include the customer name");
    });

    it("returns the admin detail shape for role=admin, viewType=detail", () => {
      const order = buildOrder();
      const mapped = mapOrder(order, "admin", "detail");
      assert.ok("otkazao" in mapped, "admin detail shape should include cancellation info");
    });

    it("returns the user short shape for role=user, viewType=short", () => {
      const order = buildOrder();
      const mapped = mapOrder(order, "user", "short");
      assert.ok(!("korisnik" in mapped), "a user viewing their own orders doesn't need their own name echoed back");
    });

    it("returns the user detail shape for role=user, viewType=detail", () => {
      const order = buildOrder();
      const mapped = mapOrder(order, "user", "detail");
      assert.ok("stavke" in mapped);
      assert.ok(!("otkazao" in mapped), "the user detail shape doesn't expose the admin-facing cancellation actor field");
    });

    it("returns null for a null order regardless of role/viewType", () => {
      assert.equal(mapOrder(null, "admin", "detail"), null);
    });
  });

  describe("null safety", () => {
    it("mapOrderForAdminDetail/mapOrderForUserDetail return null for a null order", () => {
      assert.equal(mapOrderForAdminDetail(null), null);
      assert.equal(mapOrderForUserDetail(null), null);
    });
  });
});