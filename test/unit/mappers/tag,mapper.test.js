import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapTagsForAdminList,
  mapTagForAdminDetail,
  mapTagForEdit,
  mapTagForPublic,
  mapTagsForPublic,
  mapTagForSelect,
  mapTagsForSelect,
} from "../../../src/mappers/tag.mapper.js";
import { buildTag } from "../../helpers/factories.js";

describe("tag.mapper", () => {
  describe("domain translation", () => {
    it("translates all three domains to Serbian on the admin list", () => {
      assert.equal(mapTagsForAdminList([buildTag({ domain: "post" })])[0].domen, "Blog");
      assert.equal(mapTagsForAdminList([buildTag({ domain: "service" })])[0].domen, "Usluga");
      assert.equal(mapTagsForAdminList([buildTag({ domain: "product" })])[0].domen, "Proizvod");
    });

    it("exposes the raw domain alongside the translated one", () => {
      const [mapped] = mapTagsForAdminList([buildTag({ domain: "product" })]);
      assert.equal(mapped.domenRaw, "product");
    });

    it("the admin detail shape keeps the domain untranslated (raw) - only the list view translates it", () => {
      const mapped = mapTagForAdminDetail(buildTag({ domain: "product" }));
      assert.equal(mapped.domen, "product");
    });
  });

  describe("shape variants", () => {
    it("mapTagForEdit exposes isActive as a raw boolean, not Da/Ne", () => {
      const mapped = mapTagForEdit(buildTag({ isActive: true }));
      assert.equal(mapped.isActive, true);
    });

    it("mapTagForAdminList shows aktivan as Da/Ne", () => {
      assert.equal(mapTagsForAdminList([buildTag({ isActive: true })])[0].aktivan, "Da");
      assert.equal(mapTagsForAdminList([buildTag({ isActive: false })])[0].aktivan, "Ne");
    });

    it("mapTagForPublic and mapTagForSelect are both minimal (no isActive/timestamps)", () => {
      const tag = buildTag();
      const publicShape = mapTagForPublic(tag);
      const selectShape = mapTagForSelect(tag);
      assert.ok(!("isActive" in publicShape));
      assert.ok(!("createdAt" in selectShape));
    });
  });

  describe("list helpers filter out null entries", () => {
    it("mapTagsForPublic drops nulls", () => {
      assert.equal(mapTagsForPublic([buildTag(), null]).length, 1);
    });

    it("mapTagsForSelect drops nulls", () => {
      assert.equal(mapTagsForSelect([buildTag(), null]).length, 1);
    });
  });

  describe("null safety", () => {
    it("every single-item mapper returns null for a null tag", () => {
      assert.equal(mapTagForAdminDetail(null), null);
      assert.equal(mapTagForEdit(null), null);
      assert.equal(mapTagForPublic(null), null);
      assert.equal(mapTagForSelect(null), null);
    });
  });
});