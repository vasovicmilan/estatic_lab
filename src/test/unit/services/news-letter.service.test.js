import { describe, it } from "node:test";
import assert from "node:assert/strict";
import newsLetterRepo from "../../../../src/repositories/news-letter.repository.js";
import * as newsLetterService from "../../../../src/services/news-letter.service.js";
import { buildSubscriber, id } from "../../helpers/factories.js";

describe("news-letter.service", () => {
  describe("subscribe", () => {
    it("tells an already-subscribed email it's already subscribed, without re-creating anything", async (t) => {
      t.mock.method(newsLetterRepo, "findSubscriberByEmail", async () => buildSubscriber({ status: "subscribed" }));
      const createMock = t.mock.method(newsLetterRepo, "createSubscriber", async () => {
        throw new Error("should not be called");
      });

      const result = await newsLetterService.subscribe("vec@example.com");

      assert.match(result.message, /već ste prijavljeni/i);
      assert.equal(createMock.mock.calls.length, 0);
    });

    it("re-subscribes a previously-unsubscribed email instead of creating a duplicate", async (t) => {
      const existing = buildSubscriber({ status: "unsubscribed" });
      t.mock.method(newsLetterRepo, "findSubscriberByEmail", async () => existing);
      let updatePayload;
      t.mock.method(newsLetterRepo, "updateSubscriberById", async (subId, patch) => {
        updatePayload = patch;
      });

      await newsLetterService.subscribe(existing.email);

      assert.equal(updatePayload.status, "subscribed");
      assert.equal(updatePayload.unsubscribedAt, null);
    });

    it("creates a brand-new subscriber for a fresh email", async (t) => {
      t.mock.method(newsLetterRepo, "findSubscriberByEmail", async () => null);
      let payload;
      t.mock.method(newsLetterRepo, "createSubscriber", async (data) => {
        payload = data;
        return { ...data, _id: id() };
      });

      await newsLetterService.subscribe("nov@example.com");

      assert.equal(payload.email, "nov@example.com");
      assert.ok(payload.unsubscribeToken);
    });
  });

  describe("unsubscribe", () => {
    it("rejects an invalid unsubscribe token", async (t) => {
      t.mock.method(newsLetterRepo, "findSubscriberByUnsubscribeToken", async () => null);
      await assert.rejects(() => newsLetterService.unsubscribe("bad-token"), (err) => err.statusCode === 400);
    });

    it("unsubscribes successfully with a valid token", async (t) => {
      const subscriber = buildSubscriber();
      t.mock.method(newsLetterRepo, "findSubscriberByUnsubscribeToken", async () => subscriber);
      let updatePayload;
      t.mock.method(newsLetterRepo, "updateSubscriberById", async (subId, patch) => {
        updatePayload = patch;
      });

      await newsLetterService.unsubscribe(subscriber.unsubscribeToken);

      assert.equal(updatePayload.status, "unsubscribed");
    });
  });

  describe("deleteSubscriberById", () => {
    it("throws 404 for a nonexistent subscriber", async (t) => {
      t.mock.method(newsLetterRepo, "findSubscriberById", async () => null);
      await assert.rejects(() => newsLetterService.deleteSubscriberById("missing"), (err) => err.statusCode === 404);
    });
  });
});