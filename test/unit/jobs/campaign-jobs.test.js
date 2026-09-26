import { describe, it } from "node:test";
import assert from "node:assert/strict";
import campaignRepo from "../../../src/repositories/campaign.repository.js";
import campaignService from "../../../src/services/campaign.service.js";
import auditLogService from "../../../src/services/audit-log.service.js";
import { runSendScheduledCampaigns } from "../../../src/jobs/campaign-jobs.js";
import { buildCampaign } from "../../helpers/factories.js";

describe("campaign-jobs", () => {
  it("does nothing when no campaign is due", async (t) => {
    t.mock.method(campaignRepo, "findDueScheduledCampaigns", async () => []);
    const sendMock = t.mock.method(campaignService, "sendScheduledCampaign", async () => ({ poslato: 1, neuspesno: 0 }));

    await runSendScheduledCampaigns();

    assert.equal(sendMock.mock.calls.length, 0);
  });

  it("sends every due campaign through campaignService.sendScheduledCampaign (the atomic-claim path), not sendCampaignNow", async (t) => {
    const campaigns = [buildCampaign({ status: "scheduled" }), buildCampaign({ status: "scheduled" })];
    t.mock.method(campaignRepo, "findDueScheduledCampaigns", async () => campaigns);
    const sendMock = t.mock.method(campaignService, "sendScheduledCampaign", async () => ({ poslato: 1, neuspesno: 0 }));
    t.mock.method(auditLogService, "recordAuditLog", async () => {});

    await runSendScheduledCampaigns();

    assert.equal(sendMock.mock.calls.length, 2);
  });

  it("REGRESSION: a campaign whose claim comes back null (already claimed by an overlapping tick) is skipped - no audit entry, not counted as sent, and it never falls back to sending it anyway", async (t) => {
    const campaigns = [buildCampaign({ status: "scheduled" })];
    t.mock.method(campaignRepo, "findDueScheduledCampaigns", async () => campaigns);
    const sendMock = t.mock.method(campaignService, "sendScheduledCampaign", async () => null);
    const auditMock = t.mock.method(auditLogService, "recordAuditLog", async () => {});

    await assert.doesNotReject(() => runSendScheduledCampaigns());

    assert.equal(sendMock.mock.calls.length, 1);
    assert.equal(auditMock.mock.calls.length, 0);
  });

  it("REGRESSION: one campaign's send failing (e.g. it ended up moved to 'failed') doesn't block the rest of the batch from sending on schedule", async (t) => {
    const campaigns = [buildCampaign({ status: "scheduled", _id: { toString: () => "broken" } }), buildCampaign({ status: "scheduled", _id: { toString: () => "fine" } })];
    t.mock.method(campaignRepo, "findDueScheduledCampaigns", async () => campaigns);
    t.mock.method(auditLogService, "recordAuditLog", async () => {});

    const sendMock = t.mock.method(campaignService, "sendScheduledCampaign", async (campaignId) => {
      if (campaignId === "broken") throw new Error("mail provider unreachable");
      return { poslato: 1, neuspesno: 0 };
    });

    await assert.doesNotReject(() => runSendScheduledCampaigns());

    assert.equal(sendMock.mock.calls.length, 2);
  });
});
