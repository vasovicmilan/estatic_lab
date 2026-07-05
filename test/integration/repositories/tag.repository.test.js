import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import tagRepo from "../../../src/repositories/tag.repository.js";

function validTag(overrides = {}) {
  return { name: "Opustanje", slug: "opustanje", domain: "service", ...overrides };
}

describe("tag.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createTag", () => {
    it("persists a tag", async () => {
      const tag = await tagRepo.createTag(validTag());
      assert.ok(tag._id);
    });

    it("enforces uniqueness within the same slug+domain pair", async () => {
      await tagRepo.createTag(validTag());
      await assert.rejects(() => tagRepo.createTag(validTag()));
    });

    it("allows the same slug across different domains", async () => {
      await tagRepo.createTag(validTag({ domain: "post" }));
      const tag = await tagRepo.createTag(validTag({ domain: "service" }));
      assert.ok(tag._id);
    });
  });

  describe("findTagById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await tagRepo.findTagById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findTagBySlug", () => {
    it("scopes lookups by domain", async () => {
      await tagRepo.createTag(validTag({ domain: "post" }));
      const found = await tagRepo.findTagBySlug("opustanje", "service");
      assert.equal(found, null);
    });

    it("finds a tag when slug and domain match", async () => {
      await tagRepo.createTag(validTag({ domain: "service" }));
      const found = await tagRepo.findTagBySlug("opustanje", "service");
      assert.ok(found);
    });
  });

  describe("findTags", () => {
    it("filters by domain", async () => {
      await tagRepo.createTag(validTag({ slug: "a", domain: "post" }));
      await tagRepo.createTag(validTag({ slug: "b", domain: "service" }));

      const result = await tagRepo.findTags({ filters: { domain: "service" } });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "b");
    });

    it("searches by name", async () => {
      await tagRepo.createTag(validTag({ name: "Wellness", slug: "wellness" }));
      await tagRepo.createTag(validTag({ name: "Nega Koze", slug: "nega" }));

      const result = await tagRepo.findTags({ search: "wellness" });

      assert.equal(result.data.length, 1);
    });
  });

  describe("findAllTagsByDomain", () => {
    it("returns only active tags by default", async () => {
      await tagRepo.createTag(validTag({ slug: "aktivan", isActive: true }));
      await tagRepo.createTag(validTag({ slug: "neaktivan", isActive: false }));

      const result = await tagRepo.findAllTagsByDomain("service");

      assert.equal(result.length, 1);
      assert.equal(result[0].slug, "aktivan");
    });

    it("includes inactive tags when onlyActive is false", async () => {
      await tagRepo.createTag(validTag({ slug: "neaktivan", isActive: false }));
      const result = await tagRepo.findAllTagsByDomain("service", { onlyActive: false });
      assert.equal(result.length, 1);
    });
  });

  describe("updateTagById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await tagRepo.createTag(validTag());
      const updated = await tagRepo.updateTagById(created._id, { name: "Novo Ime" });
      assert.equal(updated.name, "Novo Ime");
    });
  });

  describe("deleteTagById", () => {
    it("deletes the tag", async () => {
      const created = await tagRepo.createTag(validTag());
      await tagRepo.deleteTagById(created._id);
      const found = await tagRepo.findTagById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countTags", () => {
    it("counts tags matching a domain filter", async () => {
      await tagRepo.createTag(validTag({ slug: "a", domain: "post" }));
      await tagRepo.createTag(validTag({ slug: "b", domain: "service" }));

      const count = await tagRepo.countTags({ domain: "service" });

      assert.equal(count, 1);
    });
  });
});