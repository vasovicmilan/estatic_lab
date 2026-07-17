import { describe, it } from "node:test";
import assert from "node:assert/strict";
import contactRepo from "../../../src/repositories/contact.repository.js";
import * as contactService from "../../../src/services/contact.service.js";
import { decrypt } from "../../../src/services/crypto.service.js";
import { buildContact, id } from "../../helpers/factories.js";

describe("contact.service", () => {
  describe("submitContact", () => {
    it("requires explicit consent, even if all other fields are present", async () => {
      await assert.rejects(
        () =>
          contactService.submitContact({
            firstName: "A",
            lastName: "B",
            email: "a@b.com",
            message: "Poruka",
            consent: false,
          }),
        (err) => err.statusCode === 400
      );
    });

    it("submits successfully with consent given", async (t) => {
      const created = buildContact();
      t.mock.method(contactRepo, "createContact", async () => created);

      const result = await contactService.submitContact({
        firstName: created.firstName,
        lastName: created.lastName,
        email: created.email,
        message: created.message,
        consent: true,
      });

      assert.equal(result.email, created.email);
    });

    it("encrypts lastName, phone, and message before persisting", async (t) => {
      let persisted;
      t.mock.method(contactRepo, "createContact", async (data) => {
        persisted = data;
        return { ...data, _id: id() };
      });

      await contactService.submitContact({
        firstName: "Ana",
        lastName: "Anic",
        email: "ana@example.com",
        phone: "0641234567",
        message: "Poruka sa osetljivim sadrzajem",
        consent: true,
      });

      assert.notEqual(persisted.lastName, "Anic");
      assert.equal(decrypt(persisted.lastName), "Anic");

      assert.notEqual(persisted.phone, "0641234567");
      assert.equal(decrypt(persisted.phone), "0641234567");

      assert.notEqual(persisted.message, "Poruka sa osetljivim sadrzajem");
      assert.equal(decrypt(persisted.message), "Poruka sa osetljivim sadrzajem");

      // firstName/email/topic stay plaintext - no reason to encrypt fields nobody
      // asked to protect, and email/firstName still need to work in admin search
      assert.equal(persisted.firstName, "Ana");
      assert.equal(persisted.email, "ana@example.com");
    });

    it("leaves phone unset when none was submitted", async (t) => {
      let persisted;
      t.mock.method(contactRepo, "createContact", async (data) => {
        persisted = data;
        return { ...data, _id: id() };
      });

      await contactService.submitContact({
        firstName: "Ana",
        lastName: "Anic",
        email: "ana@example.com",
        message: "Bez telefona",
        consent: true,
      });

      assert.equal(persisted.phone, undefined);
    });
  });

  describe("updateContactStatus", () => {
    it("rejects an unknown status value", async () => {
      await assert.rejects(() => contactService.updateContactStatus(id().toString(), "invalid"), (err) => err.statusCode === 400);
    });

    it("throws 404 when the message doesn't exist", async (t) => {
      t.mock.method(contactRepo, "updateContactById", async () => null);
      await assert.rejects(() => contactService.updateContactStatus(id().toString(), "read"), (err) => err.statusCode === 404);
    });
  });
});