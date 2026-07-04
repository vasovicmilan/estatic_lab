import { describe, it } from "node:test";
import assert from "node:assert/strict";
import tagRepo from "../../../src/repositories/tag.repository.js";
import * as tagService from "../../../src/services/tag.service.js";
import { buildTag, id } from "../../helpers/factories.js";

describe("tag.service", () => {
  it("rejects an invalid domain on create", async () => {
    await assert.rejects(() => tagService.createTag({ name: "X", domain: "invalid" }), (err) => err.statusCode === 400);
  });

  it("auto-generates a slug from the name when none is given", async (t) => {
    t.mock.method(tagRepo, "findTagBySlug", async () => null);
    let payload;
    t.mock.method(tagRepo, "createTag", async (data) => {
      payload = data;
      return { ...data, _id: id() };
    });
    t.mock.method(tagRepo, "findTagById", async () => payload);

    await tagService.createTag({ name: "Opustanje i Wellness", domain: "service" });

    assert.equal(payload.slug, "opustanje-i-wellness");
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
});