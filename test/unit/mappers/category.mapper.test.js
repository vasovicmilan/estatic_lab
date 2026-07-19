import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapCategoriesForAdminList,
  mapCategoryForAdminDetail,
  mapCategoryForEdit,
  mapCategoryForPublic,
  mapCategoryForSelect,
} from "../../../src/mappers/category.mapper.js";
import { buildCategory, id } from "../../helpers/factories.js";

describe("category.mapper", () => {
  describe("meta.isActive / meta.priority (the nested fields behind the checkbox bug fix)", () => {
    it("mapCategoryForEdit flattens meta.isActive down to a top-level isActive for the form", () => {
      const category = buildCategory({ meta: { isActive: false, priority: 3 } });
      const mapped = mapCategoryForEdit(category);
      assert.equal(mapped.isActive, false);
      assert.equal(mapped.priority, 3);
    });

    it("defaults isActive to true when meta is missing entirely, rather than crashing", () => {
      const category = buildCategory({ meta: undefined });
      const mapped = mapCategoryForEdit(category);
      assert.equal(mapped.isActive, true);
    });

    it("mapCategoryForAdminDetail translates meta.isActive to Da/Ne under meta.aktivna", () => {
      const active = buildCategory({ meta: { isActive: true, priority: 0 } });
      const inactive = buildCategory({ meta: { isActive: false, priority: 0 } });
      assert.equal(mapCategoryForAdminDetail(active).meta.aktivna, "Da");
      assert.equal(mapCategoryForAdminDetail(inactive).meta.aktivna, "Ne");
    });

    it("the admin list also correctly reads the nested meta.isActive, not a nonexistent top-level field", () => {
      const category = buildCategory({ meta: { isActive: true, priority: 5 } });
      const [mapped] = mapCategoriesForAdminList([category]);
      assert.equal(mapped.aktivna, "Da");
      assert.equal(mapped.prioritet, 5);
    });
  });

  describe("domain translation", () => {
    it("translates all three domains on the list view", () => {
      assert.equal(mapCategoriesForAdminList([buildCategory({ domain: "post" })])[0].domen, "Blog");
      assert.equal(mapCategoriesForAdminList([buildCategory({ domain: "service" })])[0].domen, "Usluga");
      assert.equal(mapCategoriesForAdminList([buildCategory({ domain: "product" })])[0].domen, "Proizvod");
    });
  });

  describe("indexable translation", () => {
    it("translates isIndexable to Dozvoljeno/Zabranjeno", () => {
      assert.equal(mapCategoryForAdminDetail(buildCategory({ isIndexable: true })).meta.indeksiranje, "Dozvoljeno");
      assert.equal(mapCategoryForAdminDetail(buildCategory({ isIndexable: false })).meta.indeksiranje, "Zabranjeno");
    });
  });

  describe("parent category resolution", () => {
    it("resolves a populated parent's name on the admin list", () => {
      const parent = buildCategory({ name: "Kozmetika" });
      const category = buildCategory({ parent });
      const [mapped] = mapCategoriesForAdminList([category]);
      assert.equal(mapped.roditelj, "Kozmetika");
    });

    it("falls back to the raw id string when the parent isn't populated (list view)", () => {
      const parentId = id();
      const category = buildCategory({ parent: parentId });
      const [mapped] = mapCategoriesForAdminList([category]);
      assert.equal(mapped.roditelj, parentId.toString());
    });

    it("is null when there's no parent at all", () => {
      const category = buildCategory({ parent: null });
      const [mapped] = mapCategoriesForAdminList([category]);
      assert.equal(mapped.roditelj, null);
    });

    it("mapCategoryForEdit flattens a populated or raw parent down to a plain id string either way", () => {
      const parent = buildCategory();
      const withPopulated = mapCategoryForEdit(buildCategory({ parent }));
      assert.equal(withPopulated.parent, parent._id.toString());

      const parentId = id();
      const withRaw = mapCategoryForEdit(buildCategory({ parent: parentId }));
      assert.equal(withRaw.parent, parentId.toString());
    });

    it("the admin detail shape gives a richer {id, naziv, slug} object for a populated parent", () => {
      const parent = buildCategory({ name: "Kozmetika", slug: "kozmetika" });
      const mapped = mapCategoryForAdminDetail(buildCategory({ parent }));
      assert.deepEqual(mapped.roditelj, { id: parent._id.toString(), naziv: "Kozmetika", slug: "kozmetika" });
    });
  });

  describe("mapCategoryForPublic", () => {
    it("exposes only public-safe fields (no meta, no timestamps)", () => {
      const mapped = mapCategoryForPublic(buildCategory());
      assert.ok(!("meta" in mapped));
      assert.ok(!("createdAt" in mapped));
    });
  });

  describe("null safety", () => {
    it("every single-item mapper returns null for a null category", () => {
      assert.equal(mapCategoryForAdminDetail(null), null);
      assert.equal(mapCategoryForEdit(null), null);
      assert.equal(mapCategoryForPublic(null), null);
      assert.equal(mapCategoryForSelect(null), null);
    });
  });
});