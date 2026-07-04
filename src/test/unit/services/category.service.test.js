import { describe, it } from "node:test";
import assert from "node:assert/strict";
import categoryRepo from "../../../../src/repositories/category.repository.js";
import * as categoryService from "../../../../src/services/category.service.js";
import { buildCategory, id } from "../../helpers/factories.js";
import { buildPaginatedResult } from "../../helpers/pagination.js";

describe("category.service", () => {
  describe("domain validation", () => {
    it("rejects an invalid domain on create", async () => {
      await assert.rejects(
        () => categoryService.createCategory({ name: "X", domain: "not-a-real-domain" }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("createCategory", () => {
    it("auto-generates a slug from the name when none is given", async (t) => {
      t.mock.method(categoryRepo, "findCategoryBySlug", async () => null);
      let payload;
      t.mock.method(categoryRepo, "createCategory", async (data) => {
        payload = data;
        return { ...data, _id: id() };
      });
      t.mock.method(categoryRepo, "findCategoryById", async () => payload);

      await categoryService.createCategory({ name: "Masaze Lica", domain: "service" });

      assert.equal(payload.slug, "masaze-lica");
    });

    it("checks uniqueness scoped to slug+domain, not slug alone", async (t) => {
      const calls = [];
      t.mock.method(categoryRepo, "findCategoryBySlug", async (slug, domain) => {
        calls.push({ slug, domain });
        return null;
      });
      let payload;
      t.mock.method(categoryRepo, "createCategory", async (data) => {
        payload = data;
        return { ...data, _id: id() };
      });
      t.mock.method(categoryRepo, "findCategoryById", async () => payload);

      await categoryService.createCategory({ name: "Blog kategorija", slug: "moj-slug", domain: "post" });

      assert.equal(calls[0].domain, "post");
    });

    it("rejects an explicit slug already used in the same domain", async (t) => {
      t.mock.method(categoryRepo, "findCategoryBySlug", async () => buildCategory({ slug: "zauzeto", domain: "service" }));
      await assert.rejects(
        () => categoryService.createCategory({ name: "X", slug: "zauzeto", domain: "service" }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("deleteCategoryById", () => {
    it("refuses to delete a category that still has subcategories", async (t) => {
      t.mock.method(categoryRepo, "findCategoryById", async () => buildCategory());
      t.mock.method(categoryRepo, "findCategories", async () => buildPaginatedResult([buildCategory()], { total: 1 }));

      await assert.rejects(() => categoryService.deleteCategoryById(id().toString()), (err) => err.statusCode === 400);
    });

    it("deletes a childless category", async (t) => {
      t.mock.method(categoryRepo, "findCategoryById", async () => buildCategory());
      t.mock.method(categoryRepo, "findCategories", async () => buildPaginatedResult([], { total: 0 }));
      t.mock.method(categoryRepo, "deleteCategoryById", async () => true);

      const result = await categoryService.deleteCategoryById(id().toString());
      assert.equal(result.success, true);
    });
  });

  describe("getCategoryBySlugAndDomain", () => {
    it("treats an inactive category as not found publicly", async (t) => {
      t.mock.method(categoryRepo, "findCategoryBySlug", async () => buildCategory({ meta: { isActive: false } }));
      await assert.rejects(() => categoryService.getCategoryBySlugAndDomain("neaktivna", "service"), (err) => err.statusCode === 404);
    });
  });
});