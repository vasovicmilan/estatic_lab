import { describe, it } from "node:test";
import assert from "node:assert/strict";
import contactRepo from "../../../../src/repositories/contact.repository.js";
import * as contactService from "../../../../src/services/contact.service.js";
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