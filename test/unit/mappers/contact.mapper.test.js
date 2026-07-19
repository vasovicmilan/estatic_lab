import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapContactsForAdminList, mapContactForAdminDetail, mapContactForUserShort, mapContact } from "../../../src/mappers/contact.mapper.js";
import { encryptField } from "../../../src/utils/encrypted-field.util.js";
import { buildContact } from "../../helpers/factories.js";

describe("contact.mapper", () => {
  describe("encrypted field decryption", () => {
    it("decrypts a genuinely encrypted lastName/phone/message back to plaintext", () => {
      const contact = buildContact({
        lastName: encryptField("Jovanovic"),
        phone: encryptField("0641234567"),
        message: encryptField("Zdravo, zanima me cena tretmana."),
      });
      const mapped = mapContactForAdminDetail(contact);

      assert.equal(mapped.osnovno.prezime, "Jovanovic");
      assert.equal(mapped.osnovno.telefon, "0641234567");
      assert.equal(mapped.poruka, "Zdravo, zanima me cena tretmana.");
    });

    it("returns null for a field that isn't valid ciphertext, instead of throwing", () => {
      const contact = buildContact({ lastName: "not-actually-encrypted" });
      const mapped = mapContactForAdminDetail(contact);
      assert.equal(mapped.osnovno.prezime, null);
    });
  });

  describe("status translation", () => {
    it("translates every known status", () => {
      assert.equal(mapContactForAdminDetail(buildContact({ status: "new" })).osnovno.status, "Novi");
      assert.equal(mapContactForAdminDetail(buildContact({ status: "read" })).osnovno.status, "Pročitan");
      assert.equal(mapContactForAdminDetail(buildContact({ status: "replied" })).osnovno.status, "Odgovoren");
      assert.equal(mapContactForAdminDetail(buildContact({ status: "archived" })).osnovno.status, "Arhiviran");
    });
  });

  describe("consent display", () => {
    it("shows Da/Ne for consent as a plain boolean-to-string, not the raw boolean", () => {
      assert.equal(mapContactForAdminDetail(buildContact({ consent: true })).osnovno.saglasnost, "Da");
      assert.equal(mapContactForAdminDetail(buildContact({ consent: false })).osnovno.saglasnost, "Ne");
    });
  });

  describe("mapContactForUserShort - the visitor-facing confirmation", () => {
    it("does not expose internal fields like ip, userAgent, or status", () => {
      const mapped = mapContactForUserShort(buildContact({ lastName: encryptField("Jovanovic") }));
      assert.ok(!("ip" in mapped));
      assert.ok(!("userAgent" in mapped));
      assert.ok(!("status" in mapped));
      assert.ok("imePrezime" in mapped);
    });
  });

  describe("mapContact dispatcher", () => {
    it("returns the admin detail shape for role=admin, viewType=detail", () => {
      const mapped = mapContact(buildContact(), "admin", "detail");
      assert.ok("poruka" in mapped);
    });

    it("returns the short (visitor-facing) shape for any non-admin role, regardless of viewType", () => {
      const mapped = mapContact(buildContact(), "user", "detail");
      assert.ok(!("poruka" in mapped), "a non-admin should never see the full message shape");
    });

    it("returns null for a null contact", () => {
      assert.equal(mapContact(null, "admin", "detail"), null);
    });
  });

  describe("mapContactsForAdminList", () => {
    it("filters out null entries", () => {
      const result = mapContactsForAdminList([buildContact({ lastName: encryptField("Test") }), null]);
      assert.equal(result.length, 1);
    });
  });
});