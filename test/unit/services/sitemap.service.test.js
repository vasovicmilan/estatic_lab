import { describe, it } from "node:test";
import assert from "node:assert/strict";
import serviceService from "../../../src/services/service.service.js";
import packageService from "../../../src/services/package.service.js";
import postService from "../../../src/services/post.service.js";
import expertService from "../../../src/services/expert.service.js";
import productService from "../../../src/services/product.service.js";
import categoryService from "../../../src/services/category.service.js";
import tagService from "../../../src/services/tag.service.js";
import { getSitemapUrls } from "../../../src/services/sitemap.service.js";

function mockAllSources(t, { services = [], packages = [], posts = [], experts = [], products = [], categories = [], tags = [] } = {}) {
  t.mock.method(serviceService, "listSlugsForSitemap", async () => services);
  t.mock.method(packageService, "listSlugsForSitemap", async () => packages);
  t.mock.method(postService, "listSlugsForSitemap", async () => posts);
  t.mock.method(expertService, "listSlugsForSitemap", async () => experts);
  t.mock.method(productService, "listSlugsForSitemap", async () => products);
  t.mock.method(categoryService, "getPublicCategories", async () => categories);
  t.mock.method(tagService, "getPublicTags", async () => tags);
}

describe("sitemap.service", () => {
  it("always includes every static page, even with zero dynamic content", async (t) => {
    mockAllSources(t, {});
    const urls = await getSitemapUrls("https://beautymedica.rs");
    const homeUrl = urls.find((u) => u.loc === "https://beautymedica.rs/");
    const shopUrl = urls.find((u) => u.loc === "https://beautymedica.rs/prodavnica");
    assert.ok(homeUrl);
    assert.ok(shopUrl, "/prodavnica should be in the static pages list");
  });

  it("includes a URL for every product with a slug", async (t) => {
    mockAllSources(t, { products: [{ slug: "esma-uredjaj" }, { slug: "gel-za-tretman" }] });
    const urls = await getSitemapUrls("https://beautymedica.rs");
    assert.ok(urls.some((u) => u.loc === "https://beautymedica.rs/prodavnica/esma-uredjaj"));
    assert.ok(urls.some((u) => u.loc === "https://beautymedica.rs/prodavnica/gel-za-tretman"));
  });

  it("skips a product with no slug instead of producing a broken URL", async (t) => {
    mockAllSources(t, { products: [{ slug: null }, { slug: "valid-slug" }] });
    const urls = await getSitemapUrls("https://beautymedica.rs");
    const productUrls = urls.filter((u) => u.loc.includes("/prodavnica/") && u.loc !== "https://beautymedica.rs/prodavnica");
    assert.equal(productUrls.length, 1);
  });

  it("includes services/packages/posts/experts alongside products", async (t) => {
    mockAllSources(t, {
      services: [{ slug: "masaza" }],
      packages: [{ slug: "paket-1" }],
      posts: [{ slug: "post-1" }],
      experts: [{ slug: "ana" }],
      products: [{ slug: "proizvod-1" }],
    });
    const urls = await getSitemapUrls("https://beautymedica.rs");
    assert.ok(urls.some((u) => u.loc.endsWith("/usluge/masaza")));
    assert.ok(urls.some((u) => u.loc.endsWith("/paketi/paket-1")));
    assert.ok(urls.some((u) => u.loc.endsWith("/blog/post-1")));
    assert.ok(urls.some((u) => u.loc.endsWith("/nas-tim/ana")));
    assert.ok(urls.some((u) => u.loc.endsWith("/prodavnica/proizvod-1")));
  });

  it("still returns a valid sitemap (static pages at least) when one data source throws", async (t) => {
    t.mock.method(serviceService, "listSlugsForSitemap", async () => {
      throw new Error("DB unavailable");
    });
    t.mock.method(packageService, "listSlugsForSitemap", async () => []);
    t.mock.method(postService, "listSlugsForSitemap", async () => []);
    t.mock.method(expertService, "listSlugsForSitemap", async () => []);
    t.mock.method(productService, "listSlugsForSitemap", async () => [{ slug: "still-works" }]);
    t.mock.method(categoryService, "getPublicCategories", async () => []);
    t.mock.method(tagService, "getPublicTags", async () => []);

    const urls = await getSitemapUrls("https://beautymedica.rs");
    assert.ok(urls.some((u) => u.loc === "https://beautymedica.rs/"), "static pages should still be present");
    assert.ok(urls.some((u) => u.loc.endsWith("/prodavnica/still-works")), "other data sources should still work");
    assert.ok(!urls.some((u) => u.loc.includes("/usluge/")), "the failed source just contributes nothing, not a crash");
  });

  it("converts each entity's updatedAt into an ISO lastmod", async (t) => {
    mockAllSources(t, { products: [{ slug: "proizvod-1", updatedAt: new Date("2026-01-15T10:00:00.000Z") }] });
    const urls = await getSitemapUrls("https://beautymedica.rs");
    const productUrl = urls.find((u) => u.loc.endsWith("/prodavnica/proizvod-1"));
    assert.equal(productUrl.lastmod, "2026-01-15T10:00:00.000Z");
  });

  it("omits lastmod entirely rather than writing 'undefined' when an entity has no updatedAt", async (t) => {
    mockAllSources(t, { services: [{ slug: "masaza" }] });
    const urls = await getSitemapUrls("https://beautymedica.rs");
    const serviceUrl = urls.find((u) => u.loc.endsWith("/usluge/masaza"));
    assert.equal(serviceUrl.lastmod, undefined);
  });

  it("routes category/tag archive URLs to the right section per domain, without lastmod", async (t) => {
    mockAllSources(t, {
      categories: [{ slug: "masaze" }],
      tags: [{ slug: "popularno" }],
    });
    const urls = await getSitemapUrls("https://beautymedica.rs");
    assert.ok(urls.some((u) => u.loc === "https://beautymedica.rs/usluge/kategorija/masaze"));
    assert.ok(urls.some((u) => u.loc === "https://beautymedica.rs/prodavnica/kategorija/masaze"));
    assert.ok(urls.some((u) => u.loc === "https://beautymedica.rs/blog/kategorija/masaze"));
    assert.ok(urls.some((u) => u.loc === "https://beautymedica.rs/usluge/tag/popularno"));
    const categoryUrl = urls.find((u) => u.loc === "https://beautymedica.rs/usluge/kategorija/masaze");
    assert.equal(categoryUrl.lastmod, undefined);
  });

  it("skips a category/tag with no slug instead of producing a broken URL", async (t) => {
    mockAllSources(t, { categories: [{ slug: null }, { slug: "valid" }] });
    const urls = await getSitemapUrls("https://beautymedica.rs");
    const categoryUrls = urls.filter((u) => u.loc.includes("/kategorija/"));
    assert.equal(categoryUrls.length, 3);
  });
});