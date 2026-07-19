import { describe, it } from "node:test";
import assert from "node:assert/strict";
import serviceService from "../../../src/services/service.service.js";
import packageService from "../../../src/services/package.service.js";
import postService from "../../../src/services/post.service.js";
import expertService from "../../../src/services/expert.service.js";
import productService from "../../../src/services/product.service.js";
import { getSitemapUrls } from "../../../src/services/sitemap.service.js";

function mockAllSources(t, { services = [], packages = [], posts = [], experts = [], products = [] } = {}) {
  t.mock.method(serviceService, "findActiveServices", async () => ({ data: services }));
  t.mock.method(packageService, "findActivePackages", async () => ({ data: packages }));
  t.mock.method(postService, "findPublishedPosts", async () => ({ data: posts }));
  t.mock.method(expertService, "getActiveExperts", async () => experts);
  t.mock.method(productService, "listPublicProducts", async () => ({ data: products }));
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
    t.mock.method(serviceService, "findActiveServices", async () => {
      throw new Error("DB unavailable");
    });
    t.mock.method(packageService, "findActivePackages", async () => ({ data: [] }));
    t.mock.method(postService, "findPublishedPosts", async () => ({ data: [] }));
    t.mock.method(expertService, "getActiveExperts", async () => []);
    t.mock.method(productService, "listPublicProducts", async () => ({ data: [{ slug: "still-works" }] }));

    const urls = await getSitemapUrls("https://beautymedica.rs");
    assert.ok(urls.some((u) => u.loc === "https://beautymedica.rs/"), "static pages should still be present");
    assert.ok(urls.some((u) => u.loc.endsWith("/prodavnica/still-works")), "other data sources should still work");
    assert.ok(!urls.some((u) => u.loc.includes("/usluge/")), "the failed source just contributes nothing, not a crash");
  });
});