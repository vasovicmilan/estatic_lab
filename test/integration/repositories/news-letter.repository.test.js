import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import newsLetterRepo from "../../../src/repositories/news-letter.repository.js";

function validSubscriber(overrides = {}) {
  return { email: "pretplatnik@example.com", unsubscribeToken: "abc123", ...overrides };
}

describe("news-letter.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createSubscriber", () => {
    it("persists a subscriber, defaulting to 'subscribed'", async () => {
      const subscriber = await newsLetterRepo.createSubscriber(validSubscriber());
      assert.ok(subscriber._id);
      assert.equal(subscriber.status, "subscribed");
    });

    it("rejects a duplicate email (unique index)", async () => {
      await newsLetterRepo.createSubscriber(validSubscriber());
      await assert.rejects(() => newsLetterRepo.createSubscriber(validSubscriber()));
    });
  });

  describe("findSubscriberByEmail", () => {
    it("finds a subscriber case-insensitively", async () => {
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "test@example.com" }));
      const found = await newsLetterRepo.findSubscriberByEmail("TEST@EXAMPLE.COM");
      assert.ok(found);
    });

    it("returns null for a nonexistent email", async () => {
      const found = await newsLetterRepo.findSubscriberByEmail("nope@example.com");
      assert.equal(found, null);
    });
  });

  describe("findSubscriberByUnsubscribeToken", () => {
    it("finds a subscriber by their unsubscribe token", async () => {
      await newsLetterRepo.createSubscriber(validSubscriber({ unsubscribeToken: "unique-token" }));
      const found = await newsLetterRepo.findSubscriberByUnsubscribeToken("unique-token");
      assert.ok(found);
    });

    it("returns null for an unknown token", async () => {
      const found = await newsLetterRepo.findSubscriberByUnsubscribeToken("bad-token");
      assert.equal(found, null);
    });
  });

  describe("findSubscribers", () => {
    it("filters by status", async () => {
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "a@example.com", status: "subscribed" }));
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "b@example.com", status: "unsubscribed" }));

      const result = await newsLetterRepo.findSubscribers({ filters: { status: "subscribed" } });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].email, "a@example.com");
    });

    it("searches by email", async () => {
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "jovana@example.com" }));
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "marko@example.com" }));

      const result = await newsLetterRepo.findSubscribers({ search: "jovana" });

      assert.equal(result.data.length, 1);
    });
  });

  describe("findAllActiveSubscribers", () => {
    it("returns only subscribers with status 'subscribed'", async () => {
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "a@example.com", status: "subscribed" }));
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "b@example.com", status: "unsubscribed" }));

      const result = await newsLetterRepo.findAllActiveSubscribers();

      assert.equal(result.length, 1);
      assert.equal(result[0].email, "a@example.com");
    });
  });

  describe("updateSubscriberById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await newsLetterRepo.createSubscriber(validSubscriber());
      const updated = await newsLetterRepo.updateSubscriberById(created._id, { status: "unsubscribed" });
      assert.equal(updated.status, "unsubscribed");
    });
  });

  describe("deleteSubscriberById", () => {
    it("deletes the subscriber", async () => {
      const created = await newsLetterRepo.createSubscriber(validSubscriber());
      await newsLetterRepo.deleteSubscriberById(created._id);
      const found = await newsLetterRepo.findSubscriberById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countSubscribers", () => {
    it("counts subscribers matching a status filter", async () => {
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "a@example.com", status: "subscribed" }));
      await newsLetterRepo.createSubscriber(validSubscriber({ email: "b@example.com", status: "unsubscribed" }));

      const count = await newsLetterRepo.countSubscribers({ status: "subscribed" });

      assert.equal(count, 1);
    });
  });
});