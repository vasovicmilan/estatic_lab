import { describe, it } from "node:test";
import assert from "node:assert/strict";
import campaignRepo from "../../../src/repositories/campaign.repository.js";
import newsLetterRepo from "../../../src/repositories/news-letter.repository.js";
import leadRepo from "../../../src/repositories/lead.repository.js";
import emailService from "../../../src/services/email.service.js";
import * as campaignService from "../../../src/services/campaign.service.js";
import { buildCampaign, buildSubscriber, id } from "../../helpers/factories.js";

describe("campaign.service", () => {
  describe("createCampaign", () => {
    it("rejects a campaign without a title", async () => {
      await assert.rejects(() => campaignService.createCampaign({ subject: "X" }), (err) => err.statusCode === 400);
    });

    it("rejects a campaign without a subject", async () => {
      await assert.rejects(() => campaignService.createCampaign({ title: "X" }), (err) => err.statusCode === 400);
    });

    it("defaults to draft status and an empty targetInterests (= everyone) when not specified", async (t) => {
      let createPayload;
      t.mock.method(campaignRepo, "createCampaign", async (data) => {
        createPayload = data;
        return buildCampaign(data);
      });
      t.mock.method(campaignRepo, "findCampaignById", async () => buildCampaign(createPayload));

      await campaignService.createCampaign({ title: "Naslov", subject: "Predmet" });

      assert.equal(createPayload.status, "draft");
      assert.deepEqual(createPayload.targetInterests, []);
    });
  });

  describe("updateCampaignById / deleteCampaignById - sent campaigns are locked", () => {
    it("refuses to update an already-sent campaign", async (t) => {
      t.mock.method(campaignRepo, "findCampaignById", async () => buildCampaign({ status: "sent" }));
      await assert.rejects(
        () => campaignService.updateCampaignById(id().toString(), { title: "Novo" }),
        (err) => err.statusCode === 400
      );
    });

    it("refuses to delete an already-sent campaign", async (t) => {
      t.mock.method(campaignRepo, "findCampaignById", async () => buildCampaign({ status: "sent" }));
      await assert.rejects(() => campaignService.deleteCampaignById(id().toString()), (err) => err.statusCode === 400);
    });

    it("allows updating a draft campaign, and requires a future scheduledFor to move it to scheduled", async (t) => {
      const existing = buildCampaign({ status: "draft" });
      t.mock.method(campaignRepo, "findCampaignById", async () => existing);

      await assert.rejects(
        () => campaignService.updateCampaignById(existing._id.toString(), { status: "scheduled" }),
        (err) => err.statusCode === 400
      );

      let updatePayload;
      t.mock.method(campaignRepo, "updateCampaignById", async (campaignId, data) => {
        updatePayload = data;
        return buildCampaign(data);
      });
      const future = new Date(Date.now() + 86400000);
      await campaignService.updateCampaignById(existing._id.toString(), { status: "scheduled", scheduledFor: future });
      assert.equal(updatePayload.status, "scheduled");
      assert.deepEqual(updatePayload.scheduledFor, future);
    });
  });

  describe("sendCampaignNow", () => {
    it("refuses to re-send an already-sent campaign", async (t) => {
      t.mock.method(campaignRepo, "findCampaignDocById", async () => buildCampaign({ status: "sent" }));
      await assert.rejects(() => campaignService.sendCampaignNow(id().toString()), (err) => err.statusCode === 400);
    });

    it("targets every active subscriber when targetInterests is empty", async (t) => {
      const campaign = buildCampaign({ status: "draft", targetInterests: [] });
      t.mock.method(campaignRepo, "findCampaignDocById", async () => campaign);
      t.mock.method(campaignRepo, "findCampaignById", async () => campaign);

      const allActiveMock = t.mock.method(newsLetterRepo, "findAllActiveSubscribers", async () => [buildSubscriber()]);
      const byInterestMock = t.mock.method(newsLetterRepo, "findActiveSubscribersByInterests", async () => {
        throw new Error("should not be called for an untargeted (everyone) campaign");
      });
      t.mock.method(emailService, "sendNewsletterCampaign", async (subscribers) => subscribers.map((s) => ({ email: s.email, sent: true })));

      await campaignService.sendCampaignNow(id().toString());

      assert.equal(allActiveMock.mock.calls.length, 1);
      assert.equal(byInterestMock.mock.calls.length, 0);
    });

    it("targets only subscribers in the given segments when targetInterests is set", async (t) => {
      const campaign = buildCampaign({ status: "draft", targetInterests: ["products"] });
      t.mock.method(campaignRepo, "findCampaignDocById", async () => campaign);
      t.mock.method(campaignRepo, "findCampaignById", async () => campaign);

      const byInterestMock = t.mock.method(newsLetterRepo, "findActiveSubscribersByInterests", async (interests) => {
        assert.deepEqual(interests, ["products"]);
        return [buildSubscriber()];
      });
      t.mock.method(emailService, "sendNewsletterCampaign", async (subscribers) => subscribers.map((s) => ({ email: s.email, sent: true })));

      await campaignService.sendCampaignNow(id().toString());

      assert.equal(byInterestMock.mock.calls.length, 1);
    });

    it("records sentCount/failedCount from the per-recipient results and flips status to sent", async (t) => {
      const campaign = buildCampaign({ status: "scheduled", targetInterests: [] });
      const saveMock = t.mock.method(campaign, "save", async () => campaign);
      t.mock.method(campaignRepo, "findCampaignDocById", async () => campaign);
      t.mock.method(campaignRepo, "findCampaignById", async () => campaign);
      t.mock.method(newsLetterRepo, "findAllActiveSubscribers", async () => [buildSubscriber({ email: "a@x.com" }), buildSubscriber({ email: "b@x.com" })]);
      t.mock.method(emailService, "sendNewsletterCampaign", async () => [
        { email: "a@x.com", sent: true },
        { email: "b@x.com", sent: false, error: "bounced" },
      ]);

      await campaignService.sendCampaignNow(campaign._id.toString());

      assert.equal(campaign.status, "sent");
      assert.equal(campaign.sentCount, 1);
      assert.equal(campaign.failedCount, 1);
      assert.ok(campaign.sentAt instanceof Date);
      assert.equal(saveMock.mock.calls.length, 1);
    });

    it("doesn't call the email provider at all when the resolved segment has no active subscribers", async (t) => {
      const campaign = buildCampaign({ status: "draft", targetInterests: ["partnership"] });
      t.mock.method(campaign, "save", async () => campaign);
      t.mock.method(campaignRepo, "findCampaignDocById", async () => campaign);
      t.mock.method(campaignRepo, "findCampaignById", async () => campaign);
      t.mock.method(newsLetterRepo, "findActiveSubscribersByInterests", async () => []);
      const sendMock = t.mock.method(emailService, "sendNewsletterCampaign", async () => {
        throw new Error("should not be called with zero recipients");
      });

      await campaignService.sendCampaignNow(campaign._id.toString());

      assert.equal(sendMock.mock.calls.length, 0);
      assert.equal(campaign.sentCount, 0);
      assert.equal(campaign.status, "sent");
    });
  });

  describe("sendScheduledCampaign - used only by jobs/campaign-jobs.js's cron sweep", () => {
    it("REGRESSION: a null claim (already picked up by another/overlapping tick) is skipped without sending anything", async (t) => {
      const claimMock = t.mock.method(campaignRepo, "claimDueCampaignForSending", async () => null);
      const sendMock = t.mock.method(emailService, "sendNewsletterCampaign", async () => {
        throw new Error("should never be called - nothing was actually claimed");
      });

      const result = await campaignService.sendScheduledCampaign(id().toString());

      assert.equal(result, null);
      assert.equal(claimMock.mock.calls.length, 1);
      assert.equal(sendMock.mock.calls.length, 0);
    });

    it("REGRESSION: of two overlapping cron ticks racing to send the same due campaign, only one actually sends - the same 'atomic claim, null means someone else has it' guard as payout-request.repository.js's updatePayoutRequestStatusAtomic", async (t) => {
      // Simulates the exact race the atomic claim exists for: two ticks both
      // read the same "scheduled" campaign via findDueScheduledCampaigns
      // before either one's claim has flipped its status, then both try to
      // claim it. In real Mongo, only one findOneAndUpdate's filter (status
      // still "scheduled") matches; the other finds it already flipped to
      // "sending" and gets null. This fake repo reproduces that with a shared
      // "already claimed" flag the first call to actually match sets.
      const campaign = buildCampaign({ status: "scheduled", targetInterests: [] });
      t.mock.method(campaign, "save", async () => campaign);
      let alreadyClaimed = false;
      let claimCount = 0;

      t.mock.method(campaignRepo, "claimDueCampaignForSending", async () => {
        if (alreadyClaimed) return null; // the loser: filter no longer matches
        alreadyClaimed = true; // the winner flips status - simulates Mongo's write serialization
        claimCount += 1;
        campaign.status = "sending";
        return campaign;
      });
      t.mock.method(campaignRepo, "findCampaignById", async () => campaign);
      t.mock.method(newsLetterRepo, "findAllActiveSubscribers", async () => [buildSubscriber()]);
      const sendMock = t.mock.method(emailService, "sendNewsletterCampaign", async (subscribers) =>
        subscribers.map((s) => ({ email: s.email, sent: true }))
      );

      const results = await Promise.allSettled([
        campaignService.sendScheduledCampaign(campaign._id.toString()),
        campaignService.sendScheduledCampaign(campaign._id.toString()),
      ]);

      assert.equal(results.every((r) => r.status === "fulfilled"), true, "the skipped run resolves to null, it never rejects");
      const sentResults = results.filter((r) => r.value !== null);
      assert.equal(sentResults.length, 1, "exactly one of the two concurrent ticks must actually send");
      assert.equal(claimCount, 1, "the underlying atomic claim must only actually flip the status once");
      assert.equal(sendMock.mock.calls.length, 1, "the email provider must only actually be invoked once - no duplicate newsletter");
      assert.equal(campaign.status, "sent");
    });

    it("REGRESSION: when the send itself throws after being claimed, the campaign is moved to 'failed' (not left stuck in 'sending', and not silently left 'scheduled' for the next tick to retry)", async (t) => {
      const campaign = buildCampaign({ status: "scheduled", targetInterests: [] });
      t.mock.method(campaignRepo, "claimDueCampaignForSending", async () => campaign);
      t.mock.method(newsLetterRepo, "findAllActiveSubscribers", async () => {
        throw new Error("mail provider unreachable");
      });
      const failMock = t.mock.method(campaignRepo, "markCampaignSendFailed", async () => ({ ...campaign, status: "failed" }));

      await assert.rejects(() => campaignService.sendScheduledCampaign(campaign._id.toString()), /mail provider unreachable/);

      assert.equal(failMock.mock.calls.length, 1);
      assert.equal(failMock.mock.calls[0].arguments[0], campaign._id.toString());
    });
  });

  describe("audience narrowed by wheel campaign tag / unused coupon", () => {
    const setup = (t, campaign, subscribers, leadEmails) => {
      t.mock.method(campaignRepo, "findCampaignDocById", async () => campaign);
      t.mock.method(campaignRepo, "findCampaignById", async () => campaign);
      t.mock.method(newsLetterRepo, "findAllActiveSubscribers", async () => subscribers);
      t.mock.method(newsLetterRepo, "findActiveSubscribersByInterests", async () => subscribers);
      const leadMock = t.mock.method(leadRepo, "findEmailsByAudience", async () => leadEmails);
      let sentTo;
      t.mock.method(emailService, "sendNewsletterCampaign", async (recipients) => {
        sentTo = recipients.map((r) => r.email);
        return recipients.map((r) => ({ email: r.email, sent: true }));
      });
      return { leadMock, sent: () => sentTo };
    };

    it("sends only to active subscribers whose email is a lead of the chosen source", async (t) => {
      const campaign = buildCampaign({ status: "draft", targetSources: ["sajam-ns-2026"] });
      t.mock.method(campaign, "save", async () => campaign);
      const { leadMock, sent } = setup(t, campaign, [buildSubscriber({ email: "a@x.com" }), buildSubscriber({ email: "b@x.com" })], ["a@x.com", "nije-pretplacen@x.com"]);

      await campaignService.sendCampaignNow(campaign._id.toString());

      assert.deepEqual(sent(), ["a@x.com"]);
      assert.deepEqual(leadMock.mock.calls[0].arguments[0], { sources: ["sajam-ns-2026"], onlyUnusedCoupon: false });
    });

    it("onlyUnusedCoupon alone (no source) still narrows to wheel contacts with an unused coupon", async (t) => {
      const campaign = buildCampaign({ status: "draft", targetSources: [], onlyUnusedCoupon: true });
      t.mock.method(campaign, "save", async () => campaign);
      const { leadMock, sent } = setup(t, campaign, [buildSubscriber({ email: "a@x.com" }), buildSubscriber({ email: "b@x.com" })], ["b@x.com"]);

      await campaignService.sendCampaignNow(campaign._id.toString());

      assert.deepEqual(sent(), ["b@x.com"]);
      assert.deepEqual(leadMock.mock.calls[0].arguments[0], { sources: [], onlyUnusedCoupon: true });
    });

    it("never touches the lead collection for a campaign without these filters", async (t) => {
      const campaign = buildCampaign({ status: "draft" });
      t.mock.method(campaign, "save", async () => campaign);
      const { leadMock, sent } = setup(t, campaign, [buildSubscriber({ email: "a@x.com" })], []);

      await campaignService.sendCampaignNow(campaign._id.toString());

      assert.equal(leadMock.mock.calls.length, 0);
      assert.deepEqual(sent(), ["a@x.com"]);
    });

    it("an unsubscribed person is never reached, even if their email is a lead (only active subscribers are candidates)", async (t) => {
      const campaign = buildCampaign({ status: "draft", targetSources: ["sajam-ns-2026"] });
      t.mock.method(campaign, "save", async () => campaign);
      // findAllActiveSubscribers only returns status "subscribed" - the lead list alone can never add someone
      const { sent } = setup(t, campaign, [], ["odjavljen@x.com"]);
      t.mock.method(emailService, "sendNewsletterCampaign", async () => {
        throw new Error("should not be called");
      });

      await campaignService.sendCampaignNow(campaign._id.toString());
      assert.equal(sent(), undefined);
    });

    it("countCampaignRecipients reports the size of the resolved audience", async (t) => {
      const campaign = buildCampaign({ targetSources: ["sajam-ns-2026"] });
      setup(t, campaign, [buildSubscriber({ email: "a@x.com" }), buildSubscriber({ email: "b@x.com" })], ["a@x.com", "b@x.com"]);
      assert.equal(await campaignService.countCampaignRecipients(campaign._id.toString()), 2);
    });
  });

  describe("sendCampaignTest", () => {
    it("sends one [TEST] mail to the given address with the given name and does not change the campaign", async (t) => {
      const campaign = buildCampaign({ status: "draft", subject: "Ponuda" });
      const saveMock = t.mock.method(campaign, "save", async () => campaign);
      t.mock.method(campaignRepo, "findCampaignById", async () => campaign);
      let call;
      t.mock.method(emailService, "sendNewsletterCampaign", async (recipients, payload) => {
        call = { recipients, payload };
        return [{ email: recipients[0].email, sent: true }];
      });

      await campaignService.sendCampaignTest(campaign._id.toString(), "ja@x.com", "Milan");

      assert.equal(call.recipients.length, 1);
      assert.equal(call.recipients[0].email, "ja@x.com");
      assert.equal(call.recipients[0].firstName, "Milan");
      assert.equal(call.payload.subject, "[TEST] Ponuda");
      assert.equal(saveMock.mock.calls.length, 0);
      assert.equal(campaign.status, "draft");
    });

    it("reports a failed test send instead of pretending it worked", async (t) => {
      t.mock.method(campaignRepo, "findCampaignById", async () => buildCampaign());
      t.mock.method(emailService, "sendNewsletterCampaign", async () => [{ email: "ja@x.com", sent: false, error: "smtp down" }]);
      await assert.rejects(() => campaignService.sendCampaignTest(id().toString(), "ja@x.com"), (e) => e.statusCode === 400 && /smtp down/.test(e.message));
    });

    it("needs a campaign id and an email", async () => {
      await assert.rejects(() => campaignService.sendCampaignTest(null, "a@x.com"), (e) => e.statusCode === 400);
      await assert.rejects(() => campaignService.sendCampaignTest(id().toString(), ""), (e) => e.statusCode === 400);
    });
  });

  describe("createCampaign / updateCampaignById keep the audience filters", () => {
    it("stores targetSources and onlyUnusedCoupon on create", async (t) => {
      let payload;
      t.mock.method(campaignRepo, "createCampaign", async (data) => {
        payload = data;
        return buildCampaign(data);
      });
      t.mock.method(campaignRepo, "findCampaignById", async () => buildCampaign(payload));
      await campaignService.createCampaign({ title: "T", subject: "S", targetSources: ["sajam-ns-2026"], onlyUnusedCoupon: true });
      assert.deepEqual(payload.targetSources, ["sajam-ns-2026"]);
      assert.equal(payload.onlyUnusedCoupon, true);
    });

    it("updating with an empty selection clears the filters instead of keeping the old ones", async (t) => {
      const existing = buildCampaign({ status: "draft", targetSources: ["sajam-ns-2026"], onlyUnusedCoupon: true });
      t.mock.method(campaignRepo, "findCampaignById", async () => existing);
      let patch;
      t.mock.method(campaignRepo, "updateCampaignById", async (_id, data) => {
        patch = data;
        return { ...existing, ...data };
      });
      await campaignService.updateCampaignById(existing._id.toString(), { targetSources: [], onlyUnusedCoupon: false });
      assert.deepEqual(patch.targetSources, []);
      assert.equal(patch.onlyUnusedCoupon, false);
    });
  });
});
