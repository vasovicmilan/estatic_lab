import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import categoryRepo from "../../../src/repositories/category.repository.js";

function validCategory(overrides = {}) {
  return { name: "Masaze Lica", slug: "masaze-lica", domain: "service", ...overrides };
}

describe("category.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createCategory", () => {
    it("persists a category", async () => {
      const category = await categoryRepo.createCategory(validCategory());
      assert.ok(category._id);
      assert.equal(category.slug, "masaze-lica");
      assert.equal(category.meta.isActive, true, "meta.isActive should default to true");
    });
  });

  describe("findCategoryById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await categoryRepo.findCategoryById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findCategoryBySlug", () => {
    it("scopes lookups by domain — same slug can exist in two domains", async () => {
      await categoryRepo.createCategory(validCategory({ domain: "post" }));
      await categoryRepo.createCategory(validCategory({ domain: "service" }));

      const postCategory = await categoryRepo.findCategoryBySlug("masaze-lica", "post");
      const serviceCategory = await categoryRepo.findCategoryBySlug("masaze-lica", "service");

      assert.ok(postCategory);
      assert.ok(serviceCategory);
      assert.equal(postCategory.domain, "post");
      assert.equal(serviceCategory.domain, "service");
    });

    it("returns null when the slug exists but in a different domain", async () => {
      await categoryRepo.createCategory(validCategory({ domain: "post" }));
      const found = await categoryRepo.findCategoryBySlug("masaze-lica", "service");
      assert.equal(found, null);
    });

    it("enforces uniqueness within the same slug+domain pair", async () => {
      await categoryRepo.createCategory(validCategory({ domain: "service" }));
      await assert.rejects(() => categoryRepo.createCategory(validCategory({ domain: "service" })));
    });
  });

  describe("findCategories", () => {
    it("filters by domain", async () => {
      await categoryRepo.createCategory(validCategory({ domain: "post", slug: "blog-cat" }));
      await categoryRepo.createCategory(validCategory({ domain: "service", slug: "service-cat" }));

      const result = await categoryRepo.findCategories({ filters: { domain: "service" } });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].domain, "service");
    });

    it("filters by parent — explicit null means top-level only", async () => {
      const parent = await categoryRepo.createCategory(validCategory({ slug: "roditelj" }));
      await categoryRepo.createCategory(validCategory({ slug: "dete", parent: parent._id }));
      await categoryRepo.createCategory(validCategory({ slug: "drugi-top-level", parent: null }));

      const result = await categoryRepo.findCategories({ filters: { parent: null } });

      assert.equal(result.data.length, 2, "both parent-created category and the explicit top-level one qualify");
    });

    it("finds children of a specific parent", async () => {
      const parent = await categoryRepo.createCategory(validCategory({ slug: "roditelj" }));
      await categoryRepo.createCategory(validCategory({ slug: "dete", parent: parent._id }));

      const result = await categoryRepo.findCategories({ filters: { parent: parent._id } });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "dete");
    });

    it("searches by name case-insensitively", async () => {
      await categoryRepo.createCategory(validCategory({ name: "Opustanje i Wellness", slug: "opustanje" }));
      await categoryRepo.createCategory(validCategory({ name: "Nega Kože", slug: "nega" }));

      const result = await categoryRepo.findCategories({ search: "wellness" });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "opustanje");
    });
  });

  describe("findAllCategoriesByDomain", () => {
    it("returns only active categories by default", async () => {
      await categoryRepo.createCategory(validCategory({ slug: "aktivna", domain: "service" }));
      await categoryRepo.createCategory(validCategory({ slug: "neaktivna", domain: "service", meta: { isActive: false } }));

      const result = await categoryRepo.findAllCategoriesByDomain("service");

      assert.equal(result.length, 1);
      assert.equal(result[0].slug, "aktivna");
    });

    it("includes inactive categories when onlyActive is false", async () => {
      await categoryRepo.createCategory(validCategory({ slug: "neaktivna", domain: "service", meta: { isActive: false } }));

      const result = await categoryRepo.findAllCategoriesByDomain("service", { onlyActive: false });

      assert.equal(result.length, 1);
    });
  });

  describe("updateCategoryById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await categoryRepo.createCategory(validCategory());
      const updated = await categoryRepo.updateCategoryById(created._id, { name: "Novo Ime" });
      assert.equal(updated.name, "Novo Ime");
    });
  });

  describe("deleteCategoryById", () => {
    it("deletes the category", async () => {
      const created = await categoryRepo.createCategory(validCategory());
      await categoryRepo.deleteCategoryById(created._id);
      const found = await categoryRepo.findCategoryById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countCategories", () => {
    it("counts categories matching a domain filter", async () => {
      await categoryRepo.createCategory(validCategory({ domain: "post", slug: "a" }));
      await categoryRepo.createCategory(validCategory({ domain: "service", slug: "b" }));

      const count = await categoryRepo.countCategories({ domain: "post" });

      assert.equal(count, 1);
    });
  });
});