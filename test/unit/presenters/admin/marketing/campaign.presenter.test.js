import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareCampaignFormData, prepareCampaignDetailsData, prepareCampaignListData } from "../../../../../src/presenters/admin/marketing/campaign.presenter.js";

describe("campaign.presenter", () => {
  describe("prepareCampaignFormData", () => {
    it("posts to the create endpoint (router root) when there's no campaign yet - not the GET-only /dodavanje form page", () => {
      const view = prepareCampaignFormData(null);
      assert.equal(view.isEdit, false);
      assert.equal(view.formAction, "/admin/newsletter/kampanje");
    });

    it("PUTs to this campaign's own id endpoint when editing - not the GET-only /izmena/:id form page", () => {
      const view = prepareCampaignFormData({ id: "c1", title: "X", subject: "Y" });
      assert.equal(view.isEdit, true);
      assert.equal(view.formAction, "/admin/newsletter/kampanje/c1");
    });

    it("only offers CAMPAIGN_BLOCK_TYPES for the content field, not the full BLOG_BLOCK_TYPES list - gallery/video/table/etc don't render safely in email", () => {
      const view = prepareCampaignFormData(null);
      const contentField = view.fields.find((f) => f.name === "content");
      assert.ok(!contentField.blockTypes.includes("gallery"));
      assert.ok(!contentField.blockTypes.includes("video"));
      assert.ok(contentField.blockTypes.includes("paragraph"));
      assert.ok(contentField.blockTypes.includes("productReference"));
    });

    it("marks the campaign's current targetInterests as selected in the checkbox-group", () => {
      const view = prepareCampaignFormData({ id: "c1", title: "X", subject: "Y", targetInterests: ["products"] });
      const field = view.fields.find((f) => f.name === "targetInterests");
      assert.deepEqual(field.value, ["products"]);
      assert.ok(field.options.some((o) => o.value === "products"));
    });
  });

  describe("prepareCampaignDetailsData", () => {
    it("hides the edit link once a campaign is sent, since a sent campaign can't be edited (see campaign.service.js's assertNotSent)", () => {
      const sent = prepareCampaignDetailsData({ id: "c1", naslov: "X", predmet: "Y", status: "Poslato", statusRaw: "sent", segment: "Svi", sadrzaj: [], vreme: {} });
      const draft = prepareCampaignDetailsData({ id: "c2", naslov: "X", predmet: "Y", status: "Nacrt", statusRaw: "draft", segment: "Svi", sadrzaj: [], vreme: {} });

      assert.equal(sent.editUrl, null);
      assert.equal(draft.editUrl, "/admin/newsletter/kampanje/izmena/c2");
    });

    it("points the send-form sidebar action at this campaign's own send endpoint", () => {
      const view = prepareCampaignDetailsData({ id: "c1", naslov: "X", predmet: "Y", status: "Nacrt", statusRaw: "draft", segment: "Svi", sadrzaj: [], vreme: {} });
      const sidebar = view.sidebar.find((s) => s.content === "campaign-send-form");
      assert.equal(sidebar.data.sendUrl, "/admin/newsletter/kampanje/c1/posalji");
    });
  });

  describe("prepareCampaignListData", () => {
    it("carries the current pagination/search query through", () => {
      const view = prepareCampaignListData({ data: [], page: 2, totalPages: 5 }, { search: "leto" });
      assert.equal(view.pagination.currentPage, 2);
      assert.equal(view.topbar.search, "leto");
    });
  });
});
