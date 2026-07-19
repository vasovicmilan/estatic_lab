import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapTemporaryOrdersForAdminList,
  mapTemporaryOrderForAdminDetail,
  mapTemporaryOrderForConfirmation,
} from "../../../src/mappers/temporary-order.mapper.js";
import { buildAddressRecord } from "../../../src/utils/address.util.js";
import { buildTemporaryOrder, id } from "../../helpers/factories.js";

describe("temporary-order.mapper", () => {
  describe("token expiration flag", () => {
    it("istekao is true once the token expiration is in the past", () => {
      const order = buildTemporaryOrder({ tokenExpiration: new Date(Date.now() - 60000) });
      const mapped = mapTemporaryOrderForAdminDetail(order);
      assert.equal(mapped.token.istekao, true);
    });

    it("istekao is false while the token is still valid", () => {
      const order = buildTemporaryOrder({ tokenExpiration: new Date(Date.now() + 60000) });
      const mapped = mapTemporaryOrderForAdminDetail(order);
      assert.equal(mapped.token.istekao, false);
    });
  });

  describe("address decryption", () => {
    it("decrypts a genuinely encrypted address for the admin detail view", () => {
      const encrypted = buildAddressRecord({ city: "Novi Sad", postalCode: "21000", street: "Bulevar", number: "5" });
      const order = buildTemporaryOrder({ address: encrypted });
      const mapped = mapTemporaryOrderForAdminDetail(order);
      assert.equal(mapped.adresa.grad, "Novi Sad");
      assert.equal(mapped.adresa.ulica, "Bulevar");
    });

    it("returns null adresa for a missing address instead of throwing", () => {
      const order = buildTemporaryOrder({ address: null });
      const mapped = mapTemporaryOrderForAdminDetail(order);
      assert.equal(mapped.adresa, null);
    });
  });

  describe("mapTemporaryOrderForConfirmation - feeds order.service.js's confirmOrder", () => {
    it("renames _id to temporaryOrderId and passes through everything confirmOrder needs, unmodified", () => {
      const order = buildTemporaryOrder({ subtotal: 2000, shipping: 350, note: "Molim brzu dostavu" });
      const mapped = mapTemporaryOrderForConfirmation(order);

      assert.equal(mapped.temporaryOrderId, order._id.toString());
      assert.equal(mapped.subtotal, 2000);
      assert.equal(mapped.shipping, 350);
      assert.equal(mapped.note, "Molim brzu dostavu");
      assert.deepEqual(mapped.items, order.items);
      // phone/address stay in their raw (still-encrypted) form here - this feeds
      // directly into creating the real Order, which stores them encrypted too
      assert.equal(mapped.phone, order.phone);
      assert.deepEqual(mapped.address, order.address);
    });

    it("returns null for a null order", () => {
      assert.equal(mapTemporaryOrderForConfirmation(null), null);
    });
  });

  describe("mapTemporaryOrdersForAdminList", () => {
    it("filters out null entries", () => {
      const result = mapTemporaryOrdersForAdminList([buildTemporaryOrder(), null]);
      assert.equal(result.length, 1);
    });

    it("builds the customer's full name from contactSnapshot", () => {
      const order = buildTemporaryOrder({ contactSnapshot: { firstName: "Ana", lastName: "Anic", email: "ana@example.com" } });
      const [mapped] = mapTemporaryOrdersForAdminList([order]);
      assert.equal(mapped.korisnik, "Ana Anic");
      assert.equal(mapped.email, "ana@example.com");
    });
  });

  describe("null safety", () => {
    it("mapTemporaryOrderForAdminDetail returns null for a null order", () => {
      assert.equal(mapTemporaryOrderForAdminDetail(null), null);
    });
  });
});