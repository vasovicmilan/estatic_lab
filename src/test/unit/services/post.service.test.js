import { describe, it } from "node:test";
import assert from "node:assert/strict";
import postRepo from "../../../../src/repositories/post.repository.js";
import * as postService from "../../../../src/services/post.service.js";
import { buildPost, id } from "../../helpers/factories.js";

describe("post.service", () => {
  describe("createPost", () => {
    it("requires title, excerpt, coverImage, and author", async () => {
      await assert.rejects(() => postService.createPost({}), (err) => err.statusCode === 400);
      await assert.rejects(() => postService.createPost({ title: "X" }), (err) => err.statusCode === 400);
      await assert.rejects(() => postService.createPost({ title: "X", excerpt: "Y" }), (err) => err.statusCode === 400);
      await assert.rejects(
        () => postService.createPost({ title: "X", excerpt: "Y", coverImage: { img: "/x.webp" } }),
        (err) => err.statusCode === 400
      );
    });

    it("auto-generates a slug from the title when none is given", async (t) => {
      t.mock.method(postRepo, "findPostBySlug", async () => null);
      let payload;
      t.mock.method(postRepo, "createPost", async (data) => {
        payload = data;
        return { ...data, _id: id() };
      });
      t.mock.method(postRepo, "findPostById", async () => payload);

      await postService.createPost({ title: "Kako Da Se Opustite", excerpt: "opis", coverImage: { img: "/x.webp" }, author: id() });

      assert.equal(payload.slug, "kako-da-se-opustite");
    });

    it("rejects an explicit slug that's already taken", async (t) => {
      t.mock.method(postRepo, "findPostBySlug", async () => buildPost({ slug: "zauzeto" }));
      await assert.rejects(
        () => postService.createPost({ title: "X", slug: "zauzeto", excerpt: "Y", coverImage: { img: "/x.webp" }, author: id() }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("updatePostStatus", () => {
    it("rejects an unknown status value", async () => {
      await assert.rejects(() => postService.updatePostStatus(id().toString(), "not-a-real-status"), (err) => err.statusCode === 400);
    });

    it("accepts a valid status transition", async (t) => {
      const post = buildPost({ status: "draft" });
      t.mock.method(postRepo, "updatePostById", async () => ({ ...post, status: "published" }));
      t.mock.method(postRepo, "findPostById", async () => ({ ...post, status: "published" }));

      const result = await postService.updatePostStatus(post._id.toString(), "published");
      assert.equal(result.status, "Objavljeno");
    });
  });

  describe("getPublicPostBySlug", () => {
    it("treats a draft post as not found on the public site", async (t) => {
      t.mock.method(postRepo, "findPostBySlug", async () => buildPost({ status: "draft" }));
      await assert.rejects(() => postService.getPublicPostBySlug("nacrt"), (err) => err.statusCode === 404);
    });

    it("increments the view counter for a published post", async (t) => {
      const post = buildPost({ status: "published" });
      t.mock.method(postRepo, "findPostBySlug", async () => post);
      const incrementMock = t.mock.method(postRepo, "incrementPostViews", async () => {});

      await postService.getPublicPostBySlug(post.slug);

      assert.equal(incrementMock.mock.calls.length, 1);
    });
  });

  describe("deletePostById", () => {
    it("throws 404 for a nonexistent post", async (t) => {
      t.mock.method(postRepo, "findPostById", async () => null);
      await assert.rejects(() => postService.deletePostById("missing"), (err) => err.statusCode === 404);
    });
  });
});