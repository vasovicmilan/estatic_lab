import { describe, it } from "node:test";
import assert from "node:assert/strict";
import postService from "../../../../src/services/post.service.js";
import categoryService from "../../../../src/services/category.service.js";
import tagService from "../../../../src/services/tag.service.js";
import * as blogService from "../../../../src/services/blog.service.js";
import { id } from "../../helpers/factories.js";

describe("blog.service", () => {
  describe("getBlogLandingData", () => {
    it("aggregates posts, categories, and tags in parallel", async (t) => {
      t.mock.method(postService, "findPublishedPosts", async () => ({ data: [{ id: "p1" }], total: 1, page: 1, limit: 9, totalPages: 1 }));
      t.mock.method(categoryService, "getPublicCategories", async () => [{ id: "c1" }]);
      t.mock.method(tagService, "getPublicTags", async () => [{ id: "t1" }]);

      const result = await blogService.getBlogLandingData({});

      assert.equal(result.data.length, 1);
      assert.equal(result.categories.length, 1);
      assert.equal(result.tags.length, 1);
    });
  });

  describe("getBlogCategoryData", () => {
    it("requires a category slug", async () => {
      await assert.rejects(() => blogService.getBlogCategoryData(), (err) => err.statusCode === 400);
    });

    it("resolves the category then filters posts by its id", async (t) => {
      const categoryId = id();
      t.mock.method(categoryService, "getCategoryBySlugAndDomain", async () => ({ _id: categoryId, name: "Masaze", slug: "masaze", shortDescription: "" }));
      let filtersUsed;
      t.mock.method(postService, "findPublishedPosts", async ({ filters }) => {
        filtersUsed = filters;
        return { data: [], total: 0, page: 1, limit: 9, totalPages: 1 };
      });

      await blogService.getBlogCategoryData("masaze");

      assert.equal(filtersUsed.category, categoryId);
    });
  });

  describe("getBlogPostData", () => {
    it("requires a slug", async () => {
      await assert.rejects(() => blogService.getBlogPostData(), (err) => err.statusCode === 400);
    });

    it("finds related posts from the post's first category and excludes itself", async (t) => {
      const post = { id: "post-1", naslov: "Naslov", kratakOpis: "Opis", slug: "post-1", kategorije: [{ id: "cat-1" }], seo: {} };
      t.mock.method(postService, "getPublicPostBySlug", async () => post);
      t.mock.method(postService, "findPublishedPosts", async () => ({
        data: [{ id: "post-1" }, { id: "post-2" }, { id: "post-3" }],
      }));

      const result = await blogService.getBlogPostData("post-1");

      assert.equal(result.relatedPosts.some((p) => p.id === "post-1"), false, "a post should never appear in its own related list");
      assert.equal(result.relatedPosts.length, 2);
    });
  });

  describe("searchBlogPosts", () => {
    it("requires a non-empty search term", async () => {
      await assert.rejects(() => blogService.searchBlogPosts(""), (err) => err.statusCode === 400);
    });
  });
});