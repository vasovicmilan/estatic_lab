import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { truncate, escape, buildCanonical } from "../../../src/seo/utils.seo.js";

function fakeReq({ protocol = "https", host = "beautymedica.rs" } = {}) {
  return { protocol, get: (header) => (header === "host" ? host : null) };
}

describe("seo/utils.seo", () => {
  describe("truncate", () => {
    it("returns an empty string for falsy input", () => {
      assert.equal(truncate(null), "");
      assert.equal(truncate(""), "");
      assert.equal(truncate(undefined), "");
    });

    it("strips HTML tags before measuring/truncating", () => {
      assert.equal(truncate("<p>Hello <b>world</b></p>"), "Hello world");
    });

    it("collapses whitespace runs (including newlines from stripped block tags) into single spaces", () => {
      assert.equal(truncate("Line one\n\nLine   two"), "Line one Line two");
    });

    it("leaves short text untouched", () => {
      assert.equal(truncate("Short description."), "Short description.");
    });

    it("truncates long text to the max length with an ellipsis, total length exactly at the limit", () => {
      const longText = "a".repeat(200);
      const result = truncate(longText, 160);
      assert.equal(result.length, 160);
      assert.ok(result.endsWith("..."));
    });

    it("respects a custom max length", () => {
      const result = truncate("a".repeat(50), 20);
      assert.equal(result.length, 20);
    });
  });

  describe("escape", () => {
    it("escapes &, <, and > for safe embedding in meta tag HTML", () => {
      assert.equal(escape("Tom & Jerry <script>"), "Tom &amp; Jerry &lt;script&gt;");
    });

    it("returns an empty string for falsy input", () => {
      assert.equal(escape(null), "");
      assert.equal(escape(""), "");
    });

    it("does not double-escape an already-safe string", () => {
      assert.equal(escape("Normal text"), "Normal text");
    });
  });

  describe("buildCanonical", () => {
    it("builds a full URL from the request's protocol and host plus a path", () => {
      const url = buildCanonical(fakeReq(), "/prodavnica/esma-uredjaj");
      assert.equal(url, "https://beautymedica.rs/prodavnica/esma-uredjaj");
    });

    it("adds a leading slash if the given path is missing one", () => {
      const url = buildCanonical(fakeReq(), "prodavnica/esma-uredjaj");
      assert.equal(url, "https://beautymedica.rs/prodavnica/esma-uredjaj");
    });

    it("respects http vs https from the request", () => {
      const url = buildCanonical(fakeReq({ protocol: "http" }), "/");
      assert.match(url, /^http:\/\//);
    });
  });
});