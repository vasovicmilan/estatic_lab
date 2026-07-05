import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import postRepo from "../../../src/repositories/post.repository.js";
import "../../../src/models/user.model.js";

function validPost(overrides = {}) {
  return {
    title: "Kako Da Se Opustite",
    slug: "kako-da-se-opustite",
    excerpt: "Kratak opis posta",
    coverImage: { img: "/images/posts/opustanje.webp", imgDesc: "Opustanje" },
    author: new mongoose.Types.ObjectId(),
    status: "draft",
    ...overrides,
  };
}

describe("post.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createPost", () => {
    it("persists a post", async () => {
      const post = await postRepo.createPost(validPost());
      assert.ok(post._id);
      assert.equal(post.status, "draft");
    });

    it("rejects a duplicate slug (unique index)", async () => {
      await postRepo.createPost(validPost());
      await assert.rejects(() => postRepo.createPost(validPost({ title: "Drugi naslov" })));
    });

    it("rejects a coverImage missing the required imgDesc field", async () => {
      await assert.rejects(() =>
        postRepo.createPost(validPost({ coverImage: { img: "/images/posts/opustanje.webp" } }))
      );
    });
    
    it("computes readingTimeMinutes from content via the pre-save hook", async () => {
      const words = new Array(410).fill("reč").join(" "); // ~410 words -> ceil(410/200) = 3
      const post = await postRepo.createPost(validPost({ content: [{ type: "paragraph", text: words, order: 0 }] }));
      assert.equal(post.readingTimeMinutes, 3);
    });

    it("sets publishedAt automatically when created directly as published", async () => {
      const post = await postRepo.createPost(validPost({ status: "published" }));
      assert.ok(post.publishedAt);
    });
  });

  describe("findPostById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await postRepo.findPostById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findPostBySlug", () => {
    it("finds a post by its slug", async () => {
      await postRepo.createPost(validPost());
      const found = await postRepo.findPostBySlug("kako-da-se-opustite");
      assert.ok(found);
    });
  });

  describe("findPosts", () => {
    it("filters to published-only, excluding future-dated posts", async () => {
      await postRepo.createPost(validPost({ title: "Objavljen", slug: "objavljen", status: "published" }));
      await postRepo.createPost(validPost({ title: "Nacrt", slug: "nacrt", status: "draft" }));

      const result = await postRepo.findPosts({ filters: { publishedOnly: true }, populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "objavljen");
    });

    it("searches by title and excerpt", async () => {
      await postRepo.createPost(validPost({ title: "Meditacija za pocetnike", slug: "meditacija" }));
      await postRepo.createPost(validPost({ title: "Ishrana i wellness", slug: "ishrana" }));

      const result = await postRepo.findPosts({ search: "Meditacija", populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "meditacija");
    });
  });

  describe("incrementPostViews", () => {
    it("atomically increments the views counter", async () => {
      const created = await postRepo.createPost(validPost());
      const updated = await postRepo.incrementPostViews(created._id);
      assert.equal(updated.views, 1);
    });
  });

  describe("updatePostById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await postRepo.createPost(validPost());
      const updated = await postRepo.updatePostById(created._id, { title: "Novi Naslov" });
      assert.equal(updated.title, "Novi Naslov");
    });
  });

  describe("deletePostById", () => {
    it("deletes the post", async () => {
      const created = await postRepo.createPost(validPost());
      await postRepo.deletePostById(created._id);
      const found = await postRepo.findPostById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countPosts", () => {
    it("counts posts matching a status filter", async () => {
      await postRepo.createPost(validPost({ title: "A", slug: "a", status: "draft" }));
      await postRepo.createPost(validPost({ title: "B", slug: "b", status: "published" }));

      const count = await postRepo.countPosts({ status: "published" });

      assert.equal(count, 1);
    });
  });
});