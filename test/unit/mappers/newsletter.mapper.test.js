import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapSubscribersForAdminList, mapSubscriberForAdminDetail } from "../../../src/mappers/news-letter.mapper.js";
import { buildSubscriber } from "../../helpers/factories.js";

describe("news-letter.mapper", () => {
  describe("status translation", () => {
    it("translates 'subscribed' and 'unsubscribed' to Serbian, exposing the raw value too", () => {
      const subscribed = mapSubscriberForAdminDetail(buildSubscriber({ status: "subscribed" }));
      const unsubscribed = mapSubscriberForAdminDetail(buildSubscriber({ status: "unsubscribed" }));

      assert.equal(subscribed.osnovno.status, "Prijavljen");
      assert.equal(subscribed.osnovno.statusRaw, "subscribed");
      assert.equal(unsubscribed.osnovno.status, "Odjavljen");
    });
  });

  describe("mapSubscriberForAdminDetail", () => {
    it("shows null for odjavljen when the subscriber never unsubscribed", () => {
      const mapped = mapSubscriberForAdminDetail(buildSubscriber({ unsubscribedAt: null }));
      assert.equal(mapped.vreme.odjavljen, null);
    });

    it("formats odjavljen when the subscriber did unsubscribe", () => {
      const mapped = mapSubscriberForAdminDetail(buildSubscriber({ unsubscribedAt: new Date("2026-05-01T10:00:00Z") }));
      assert.ok(mapped.vreme.odjavljen);
    });

    it("returns null for a null subscriber", () => {
      assert.equal(mapSubscriberForAdminDetail(null), null);
    });
  });

  describe("mapSubscribersForAdminList", () => {
    it("filters out null entries", () => {
      const result = mapSubscribersForAdminList([buildSubscriber(), null]);
      assert.equal(result.length, 1);
    });
  });
});