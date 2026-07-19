import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapPostsForAdminList, mapPostForAdminDetail, mapPostForEdit, mapPostForPublicDetail } from "../../../src/mappers/post.mapper.js";
import { buildPost, buildUser, id } from "../../helpers/factories.js";

describe("post.mapper", () => {
  describe("status translation", () => {
    it("translates draft/published/archived", () => {
      assert.equal(mapPostForAdminDetail(buildPost({ status: "draft" })).status, "Nacrt");
      assert.equal(mapPostForAdminDetail(buildPost({ status: "published" })).status, "Objavljeno");
      assert.equal(mapPostForAdminDetail(buildPost({ status: "archived" })).status, "Arhivirano");
    });
  });

  describe("author resolution", () => {
    it("builds the author's full name when populated", () => {
      const post = buildPost({ author: buildUser({ firstName: "Jovana", lastName: "Jovanovic" }) });
      const mapped = mapPostForAdminDetail(post);
      assert.equal(mapped.autor.ime, "Jovana Jovanovic");
    });

    it("falls back to 'Nepoznat autor' when unpopulated, without crashing on a null author", () => {
      const withNull = mapPostForAdminDetail(buildPost({ author: null }));
      assert.equal(withNull.autor.ime, "Nepoznat autor");

      const withRawId = mapPostForAdminDetail(buildPost({ author: id() }));
      assert.equal(withRawId.autor.ime, "Nepoznat autor");
    });

    it("mapPostForEdit resolves the author id whether populated or raw", () => {
      const author = buildUser();
      const withPopulated = mapPostForEdit(buildPost({ author }));
      assert.equal(withPopulated.author, author._id.toString());

      const rawId = id();
      const withRaw = mapPostForEdit(buildPost({ author: rawId }));
      assert.equal(withRaw.author, rawId.toString());
    });
  });

  describe("content block rendering", () => {
    it("sorts blocks by their order field, not array insertion order", () => {
      const post = buildPost({
        content: [
          { type: "paragraph", text: "Second", order: 2 },
          { type: "paragraph", text: "First", order: 1 },
        ],
      });
      const mapped = mapPostForAdminDetail(post);
      assert.equal(mapped.sadrzaj[0].tekst, "First");
      assert.equal(mapped.sadrzaj[1].tekst, "Second");
    });

    it("treats a missing order as 0, sorting it first", () => {
      const post = buildPost({
        content: [
          { type: "paragraph", text: "Has order", order: 1 },
          { type: "paragraph", text: "No order" },
        ],
      });
      const mapped = mapPostForAdminDetail(post);
      assert.equal(mapped.sadrzaj[0].tekst, "No order");
    });
  });

  describe("category/tag name extraction", () => {
    it("only includes populated categories/tags with a name", () => {
      const post = buildPost({ categories: [{ name: "Nega lica" }, id()], tags: [{ name: "Popularno" }, id()] });
      const mapped = mapPostForAdminDetail(post);
      assert.deepEqual(mapped.kategorije, ["Nega lica"]);
      assert.deepEqual(mapped.tagovi, ["Popularno"]);
    });
  });

  describe("reading time", () => {
    it("always shows a 'X min' string, even for 0", () => {
      const mapped = mapPostForAdminDetail(buildPost({ readingTimeMinutes: 0 }));
      assert.equal(mapped.vremeCitanja, "0 min");
    });
  });

  describe("public detail (uses slugs, not names, for categories - links vs display)", () => {
    it("mapPostForPublicDetail returns category slugs, not names", () => {
      const post = buildPost({ categories: [{ name: "Nega lica", slug: "nega-lica" }] });
      const mapped = mapPostForPublicDetail(post);
      assert.deepEqual(mapped.kategorije, ["nega-lica"]);
    });
  });

  describe("mapPostsForAdminList", () => {
    it("filters out null entries", () => {
      assert.equal(mapPostsForAdminList([buildPost(), null]).length, 1);
    });
  });

  describe("null safety", () => {
    it("returns null for a null post across every single-item mapper", () => {
      assert.equal(mapPostForAdminDetail(null), null);
      assert.equal(mapPostForEdit(null), null);
      assert.equal(mapPostForPublicDetail(null), null);
    });
  });
});