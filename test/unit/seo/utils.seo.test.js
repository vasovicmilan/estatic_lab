import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { truncate, escape, buildCanonical, buildBreadcrumbJsonLd, buildItemListJsonLd, buildAggregateRatingJsonLd, buildReviewJsonLd, appendPageParam, buildWebsiteJsonLd } from "../../../src/seo/utils.seo.js";

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

  describe("appendPageParam", () => {
    it("leaves the canonical unchanged for page 1 or no page", () => {
      assert.equal(appendPageParam("https://beautymedica.rs/usluge", 1), "https://beautymedica.rs/usluge");
      assert.equal(appendPageParam("https://beautymedica.rs/usluge", undefined), "https://beautymedica.rs/usluge");
      assert.equal(appendPageParam("https://beautymedica.rs/usluge", "not-a-number"), "https://beautymedica.rs/usluge");
    });

    it("appends ?page=N for page 2 and beyond, producing a self-referencing canonical", () => {
      assert.equal(appendPageParam("https://beautymedica.rs/usluge", 2), "https://beautymedica.rs/usluge?page=2");
      assert.equal(appendPageParam("https://beautymedica.rs/usluge", "3"), "https://beautymedica.rs/usluge?page=3");
    });

    it("uses & instead of ? when the canonical already has a query string", () => {
      assert.equal(appendPageParam("https://beautymedica.rs/prodavnica?badge=sale", 2), "https://beautymedica.rs/prodavnica?badge=sale&page=2");
    });
  });

  describe("buildWebsiteJsonLd", () => {
    it("builds a valid WebSite schema with a SearchAction pointing at the real blog search route", () => {
      const result = buildWebsiteJsonLd(fakeReq());
      assert.equal(result["@type"], "WebSite");
      assert.equal(result.url, "https://beautymedica.rs/");
      assert.equal(result.potentialAction["@type"], "SearchAction");
      assert.equal(result.potentialAction.target, "https://beautymedica.rs/blog/pretraga?q={search_term_string}");
      assert.equal(result.potentialAction["query-input"], "required name=search_term_string");
    });
  });

  describe("buildBreadcrumbJsonLd", () => {
    it("builds a valid BreadcrumbList with 1-indexed positions", () => {
      const result = buildBreadcrumbJsonLd([
        { name: "Početna", url: "https://beautymedica.rs/" },
        { name: "Usluge", url: "https://beautymedica.rs/usluge" },
        { name: "Terapeutska masaža", url: "https://beautymedica.rs/usluge/terapeutska-masaza" },
      ]);
      assert.equal(result["@type"], "BreadcrumbList");
      assert.equal(result.itemListElement.length, 3);
      assert.equal(result.itemListElement[0].position, 1);
      assert.equal(result.itemListElement[2].position, 3);
      assert.equal(result.itemListElement[2].name, "Terapeutska masaža");
    });

    it("drops entries missing a name or url instead of leaving a gap", () => {
      const result = buildBreadcrumbJsonLd([
        { name: "Početna", url: "https://beautymedica.rs/" },
        { name: null, url: "https://beautymedica.rs/broken" },
        { name: "Usluge", url: "https://beautymedica.rs/usluge" },
      ]);
      assert.equal(result.itemListElement.length, 2);
      assert.equal(result.itemListElement[1].position, 2);
    });

    it("returns null when there are no valid entries, so callers can skip emitting the block", () => {
      assert.equal(buildBreadcrumbJsonLd([]), null);
      assert.equal(buildBreadcrumbJsonLd([{ name: null, url: null }]), null);
    });
  });

  describe("buildItemListJsonLd", () => {
    it("builds a valid ItemList with absolute URLs resolved via the request", () => {
      const result = buildItemListJsonLd(fakeReq(), [
        { name: "Terapeutska masaža", path: "/usluge/terapeutska-masaza" },
        { name: "Anticelulit masaža", path: "/usluge/anticelulit-masaza" },
      ]);
      assert.equal(result["@type"], "ItemList");
      assert.equal(result.itemListElement.length, 2);
      assert.equal(result.itemListElement[0].url, "https://beautymedica.rs/usluge/terapeutska-masaza");
      assert.equal(result.itemListElement[1].position, 2);
    });

    it("skips an entry with no name or path instead of producing a broken ListItem", () => {
      const result = buildItemListJsonLd(fakeReq(), [
        { name: "Valid", path: "/usluge/valid" },
        { name: null, path: "/usluge/broken" },
      ]);
      assert.equal(result.itemListElement.length, 1);
    });

    it("returns null for an empty list, so callers can skip emitting the block entirely", () => {
      assert.equal(buildItemListJsonLd(fakeReq(), []), null);
    });
  });

  describe("buildAggregateRatingJsonLd", () => {
    it("builds a valid AggregateRating from a rating summary", () => {
      const result = buildAggregateRatingJsonLd({ average: 4.6667, count: 12 });
      assert.equal(result["@type"], "AggregateRating");
      assert.equal(result.reviewCount, 12);
      assert.equal(result.bestRating, 5);
    });

    it("rounds the average rating to one decimal place", () => {
      const result = buildAggregateRatingJsonLd({ average: 4.6667, count: 3 });
      assert.equal(result.ratingValue, 4.7);
    });

    it("returns null when there are zero reviews, rather than fabricating a rating block", () => {
      assert.equal(buildAggregateRatingJsonLd({ average: 0, count: 0 }), null);
      assert.equal(buildAggregateRatingJsonLd(null), null);
      assert.equal(buildAggregateRatingJsonLd(undefined), null);
    });
  });

  describe("buildReviewJsonLd", () => {
    it("builds a Review array matching the mapped testimonial shape (ime/ocena/komentar)", () => {
      const result = buildReviewJsonLd([{ ime: "Milan Vasović", ocena: 5, komentar: "Odličan tretman!" }]);
      assert.equal(result.length, 1);
      assert.equal(result[0]["@type"], "Review");
      assert.equal(result[0].author.name, "Milan Vasović");
      assert.equal(result[0].reviewRating.ratingValue, 5);
      assert.equal(result[0].reviewBody, "Odličan tretman!");
    });

    it("falls back to 'Anoniman' when a review has no author name", () => {
      const result = buildReviewJsonLd([{ ime: null, ocena: 4, komentar: "Vrlo dobro." }]);
      assert.equal(result[0].author.name, "Anoniman");
    });

    it("skips a testimonial with no rating or no message", () => {
      const result = buildReviewJsonLd([
        { ime: "A", ocena: null, komentar: "Tekst." },
        { ime: "B", ocena: 5, komentar: null },
        { ime: "C", ocena: 5, komentar: "Validan." },
      ]);
      assert.equal(result.length, 1);
      assert.equal(result[0].author.name, "C");
    });

    it("returns null for an empty or all-invalid list", () => {
      assert.equal(buildReviewJsonLd([]), null);
      assert.equal(buildReviewJsonLd([{ ime: "A", ocena: null, komentar: null }]), null);
    });
  });
});