import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import contactRepo from "../../../src/repositories/contact.repository.js";

function validContact(overrides = {}) {
  return {
    firstName: "Jovana",
    lastName: "Jovanovic",
    email: "jovana@example.com",
    message: "Zdravo, zanima me vise o vasim uslugama.",
    consent: true,
    status: "new",
    ...overrides,
  };
}

describe("contact.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createContact", () => {
    it("persists a contact message", async () => {
      const contact = await contactRepo.createContact(validContact());
      assert.ok(contact._id);
      assert.equal(contact.status, "new");
    });
  });

  describe("findContactById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await contactRepo.findContactById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findContacts", () => {
    it("filters by status", async () => {
      await contactRepo.createContact(validContact({ email: "a@example.com", status: "new" }));
      await contactRepo.createContact(validContact({ email: "b@example.com", status: "replied" }));

      const result = await contactRepo.findContacts({ filters: { status: "replied" } });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].email, "b@example.com");
    });

    it("searches across firstName, lastName, email, and message", async () => {
      await contactRepo.createContact(validContact({ firstName: "Petar", lastName: "Petrovic", email: "petar@example.com" }));
      await contactRepo.createContact(validContact({ firstName: "Jovana", lastName: "Jovanovic", email: "jovana@example.com" }));

      const result = await contactRepo.findContacts({ search: "Petar" });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].email, "petar@example.com");
    });
  });

  describe("updateContactById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await contactRepo.createContact(validContact());
      const updated = await contactRepo.updateContactById(created._id, { status: "read" });
      assert.equal(updated.status, "read");
    });
  });

  describe("deleteContactById", () => {
    it("deletes the contact message", async () => {
      const created = await contactRepo.createContact(validContact());
      await contactRepo.deleteContactById(created._id);
      const found = await contactRepo.findContactById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countContacts", () => {
    it("counts contact messages matching a status filter", async () => {
      await contactRepo.createContact(validContact({ email: "a@example.com", status: "new" }));
      await contactRepo.createContact(validContact({ email: "b@example.com", status: "read" }));

      const count = await contactRepo.countContacts({ status: "new" });

      assert.equal(count, 1);
    });
  });
});