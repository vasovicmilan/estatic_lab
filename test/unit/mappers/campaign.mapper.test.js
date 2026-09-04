import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapCampaignsForAdminList, mapCampaignForAdminDetail, mapCampaignForEdit, translateInterest } from "../../../src/mappers/campaign.mapper.js";
import { buildCampaign } from "../../helpers/factories.js";

describe("campaign.mapper", () => {
  describe("segment label", () => {
    it("shows 'Svi pretplatnici' when targetInterests is empty - matches campaign.service.js's sendCampaignNow reading empty as 'everyone'", () => {
      const campaign = buildCampaign({ targetInterests: [] });
      assert.equal(mapCampaignsForAdminList([campaign])[0].segment, "Svi pretplatnici");
      assert.equal(mapCampaignForAdminDetail(campaign).segment, "Svi pretplatnici");
    });

    it("joins translated interest labels when targeted", () => {
      const campaign = buildCampaign({ targetInterests: ["products", "partnership"] });
      assert.equal(mapCampaignForAdminDetail(campaign).segment, "Proizvodi, Partnerski program");
    });
  });

  describe("status-dependent fields", () => {
    it("only shows zakazanoZa on the list when status is scheduled, even if scheduledFor happens to be set on a draft", () => {
      const scheduledFor = new Date(Date.now() + 86400000);
      const draft = buildCampaign({ status: "draft", scheduledFor });
      const scheduled = buildCampaign({ status: "scheduled", scheduledFor });

      assert.equal(mapCampaignsForAdminList([draft])[0].zakazanoZa, null);
      assert.ok(mapCampaignsForAdminList([scheduled])[0].zakazanoZa);
    });

    it("only shows poslatoZa/counts on the list once status is sent", () => {
      const sent = buildCampaign({ status: "sent", sentAt: new Date(), sentCount: 12, failedCount: 1 });
      const row = mapCampaignsForAdminList([sent])[0];
      assert.ok(row.poslatoZa);
      assert.equal(row.poslato, 12);
      assert.equal(row.neuspesno, 1);
    });
  });

  describe("mapCampaignForEdit", () => {
    it("formats scheduledFor as a datetime-local-ready string, same convention as mapPostForEdit", () => {
      const campaign = buildCampaign({ scheduledFor: new Date("2026-09-15T12:00:00.000Z") });
      const mapped = mapCampaignForEdit(campaign);
      assert.match(mapped.scheduledFor, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it("returns an empty string when scheduledFor is null", () => {
      const mapped = mapCampaignForEdit(buildCampaign({ scheduledFor: null }));
      assert.equal(mapped.scheduledFor, "");
    });

    it("passes through content/targetInterests as-is for the form to re-render", () => {
      const content = [{ type: "paragraph", text: "x" }];
      const mapped = mapCampaignForEdit(buildCampaign({ content, targetInterests: ["general"] }));
      assert.deepEqual(mapped.content, content);
      assert.deepEqual(mapped.targetInterests, ["general"]);
    });
  });

  describe("translateInterest", () => {
    it("translates known interests to Serbian labels", () => {
      assert.equal(translateInterest("general"), "Opšte");
      assert.equal(translateInterest("products"), "Proizvodi");
      assert.equal(translateInterest("partnership"), "Partnerski program");
    });

    it("falls back to the raw value for an unknown interest", () => {
      assert.equal(translateInterest("nesto-novo"), "nesto-novo");
    });
  });
});
