import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import categoryRepo from "../../../src/repositories/category.repository.js";
import productRepo from "../../../src/repositories/product.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import packageRepo from "../../../src/repositories/package.repository.js";
import * as categoryService from "../../../src/services/category.service.js";
import { buildCategory, id } from "../../helpers/factories.js";
import { buildPaginatedResult } from "../../helpers/pagination.js";

// deleteCategoryById wraps its auto-cleanup + delete in a real Mongo transaction -
// faking the session lets this run as a pure unit test instead of needing a
// replica-set-backed mongodb-memory-server instance.
function mockSession(t) {
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));
}

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
      let created;
      t.mock.method(categoryRepo, "createCategory", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(categoryRepo, "findCategoryById", async () => created);

      await categoryService.createCategory({ name: "Masaze Lica", domain: "service" });

      assert.equal(created.slug, "masaze-lica");
    });

    it("checks uniqueness scoped to slug+domain, not slug alone", async (t) => {
      const calls = [];
      t.mock.method(categoryRepo, "findCategoryBySlug", async (slug, domain) => {
        calls.push({ slug, domain });
        return null;
      });
      let created;
      t.mock.method(categoryRepo, "createCategory", async (data) => {
        created = { ...data, _id: id() };
        return created;
      });
      t.mock.method(categoryRepo, "findCategoryById", async () => created);

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

    it("deletes a childless category and pulls its reference from Product/Service/Package", async (t) => {
      mockSession(t);
      t.mock.method(categoryRepo, "findCategoryById", async () => buildCategory());
      t.mock.method(categoryRepo, "findCategories", async () => buildPaginatedResult([], { total: 0 }));
      t.mock.method(categoryRepo, "deleteCategoryById", async () => true);

      const pullCalls = { product: 0, service: 0, package: 0 };
      t.mock.method(productRepo, "pullCategoryFromAllProducts", async () => { pullCalls.product++; });
      t.mock.method(serviceRepo, "pullCategoryFromAllServices", async () => { pullCalls.service++; });
      t.mock.method(packageRepo, "pullCategoryFromAllPackages", async () => { pullCalls.package++; });

      const result = await categoryService.deleteCategoryById(id().toString());

      assert.equal(result.success, true);
      assert.equal(pullCalls.product, 1);
      assert.equal(pullCalls.service, 1);
      assert.equal(pullCalls.package, 1);
    });
  });

  describe("getCategoryBySlugAndDomain", () => {
    it("treats an inactive category as not found publicly", async (t) => {
      t.mock.method(categoryRepo, "findCategoryBySlug", async () => buildCategory({ meta: { isActive: false } }));
      await assert.rejects(() => categoryService.getCategoryBySlugAndDomain("neaktivna", "service"), (err) => err.statusCode === 404);
    });
  });
});