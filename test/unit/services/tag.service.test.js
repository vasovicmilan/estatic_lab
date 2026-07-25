import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import tagRepo from "../../../src/repositories/tag.repository.js";
import packageRepo from "../../../src/repositories/package.repository.js";
import postRepo from "../../../src/repositories/post.repository.js";
import productRepo from "../../../src/repositories/product.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import * as tagService from "../../../src/services/tag.service.js";
import { buildTag, id } from "../../helpers/factories.js";

// deleteTagById wraps its auto-cleanup + delete in a real Mongo transaction -
// faking the session lets this run as a pure unit test instead of needing a
// replica-set-backed mongodb-memory-server instance.
function mockSession(t) {
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));
}

describe("tag.service", () => {
  it("rejects an invalid domain on create", async () => {
    await assert.rejects(() => tagService.createTag({ name: "X", domain: "invalid" }), (err) => err.statusCode === 400);
  });

  it("auto-generates a slug from the name when none is given", async (t) => {
    t.mock.method(tagRepo, "findTagBySlug", async () => null);
    let created;
    t.mock.method(tagRepo, "createTag", async (data) => {
      created = { ...data, _id: id() };
      return created;
    });
    t.mock.method(tagRepo, "findTagById", async () => created);

    await tagService.createTag({ name: "Opustanje i Wellness", domain: "service" });

    assert.equal(created.slug, "opustanje-i-wellness");
  });

  it("rejects an explicit slug already used in the same domain", async (t) => {
    t.mock.method(tagRepo, "findTagBySlug", async () => buildTag({ slug: "zauzeto" }));
    await assert.rejects(
      () => tagService.createTag({ name: "X", slug: "zauzeto", domain: "service" }),
      (err) => err.statusCode === 409
    );
  });

  it("getTagBySlugAndDomain treats an inactive tag as not found", async (t) => {
    t.mock.method(tagRepo, "findTagBySlug", async () => buildTag({ isActive: false }));
    await assert.rejects(() => tagService.getTagBySlugAndDomain("neaktivan", "service"), (err) => err.statusCode === 404);
  });

  it("deleteTagById throws 404 for a nonexistent tag", async (t) => {
    t.mock.method(tagRepo, "findTagById", async () => null);
    await assert.rejects(() => tagService.deleteTagById("missing"), (err) => err.statusCode === 404);
  });

  it("deleteTagById pulls the tag from Package/Post/Product/Service, with no blocking check at all", async (t) => {
    mockSession(t);
    t.mock.method(tagRepo, "findTagById", async () => buildTag());
    t.mock.method(tagRepo, "deleteTagById", async () => true);

    const pullCalls = { package: 0, post: 0, product: 0, service: 0 };
    t.mock.method(packageRepo, "pullTagFromAllPackages", async () => { pullCalls.package++; });
    t.mock.method(postRepo, "pullTagFromAllPosts", async () => { pullCalls.post++; });
    t.mock.method(productRepo, "pullTagFromAllProducts", async () => { pullCalls.product++; });
    t.mock.method(serviceRepo, "pullTagFromAllServices", async () => { pullCalls.service++; });

    const result = await tagService.deleteTagById(id().toString());

    assert.equal(result.success, true);
    assert.equal(pullCalls.package, 1);
    assert.equal(pullCalls.post, 1);
    assert.equal(pullCalls.product, 1);
    assert.equal(pullCalls.service, 1);
  });

  it("aborts the whole transaction and never reaches the terminal delete when a cleanup step fails", async (t) => {
    mockSession(t);
    t.mock.method(tagRepo, "findTagById", async () => buildTag());
    t.mock.method(packageRepo, "pullTagFromAllPackages", async () => {
      throw new Error("Simulated write failure mid-transaction");
    });
    let deleteCalled = false;
    t.mock.method(tagRepo, "deleteTagById", async () => {
      deleteCalled = true;
      return true;
    });

    await assert.rejects(() => tagService.deleteTagById(id().toString()), /Simulated write failure/);

    assert.equal(deleteCalled, false, "the tag itself must not be deleted if a cleanup step failed");
  });
});