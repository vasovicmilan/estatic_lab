import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCategorySeo } from "../../../src/seo/builders/category.builder.js";
import { buildTagSeo } from "../../../src/seo/builders/tag.builder.js";
import { buildProductSeo } from "../../../src/seo/builders/product.builder.js";
import { buildServiceSeo } from "../../../src/seo/builders/service.builder.js";
import { buildPostSeo } from "../../../src/seo/builders/post.builder.js";
import { buildExpertSeo } from "../../../src/seo/builders/expert.builder.js";
import { buildPageSeoWithReq } from "../../../src/seo/builders/page.builder.js";

function fakeReq() {
  return { protocol: "https", get: (h) => (h === "host" ? "beautymedica.rs" : null) };
}

describe("seo builders", () => {
  describe("category/tag canonical routing by domain - regression test for the /usluge vs /prodavnica bug", () => {
    it("buildCategorySeo routes a 'product' domain category to /prodavnica/kategorija/, not /usluge/kategorija/", async () => {
      const seo = await buildCategorySeo({ name: "Elektronika", slug: "elektronika", domain: "product" }, fakeReq());
      assert.equal(seo.canonical, "https://beautymedica.rs/prodavnica/kategorija/elektronika");
    });

    it("buildCategorySeo routes 'post' to /blog/kategorija/ and everything else to /usluge/kategorija/", async () => {
      const post = await buildCategorySeo({ name: "Nega", slug: "nega", domain: "post" }, fakeReq());
      assert.equal(post.canonical, "https://beautymedica.rs/blog/kategorija/nega");

      const service = await buildCategorySeo({ name: "Masaze", slug: "masaze", domain: "service" }, fakeReq());
      assert.equal(service.canonical, "https://beautymedica.rs/usluge/kategorija/masaze");
    });

    it("buildTagSeo routes a 'product' domain tag to /prodavnica/tag/", async () => {
      const seo = await buildTagSeo({ name: "Popularno", slug: "popularno", domain: "product" }, fakeReq());
      assert.equal(seo.canonical, "https://beautymedica.rs/prodavnica/tag/popularno");
    });
  });

  describe("title fallback: named entity | site name, or just site name if unnamed", () => {
    it("buildProductSeo falls back to the bare site name when the product has no name", async () => {
      const seo = await buildProductSeo({ naziv: "", slug: "x" }, fakeReq());
      assert.equal(seo.title, "Estetik Lab");
    });

    it("buildProductSeo escapes HTML in the product name (XSS safety in meta tags)", async () => {
      const seo = await buildProductSeo({ naziv: "<script>alert(1)</script>", slug: "x" }, fakeReq());
      assert.ok(!seo.title.includes("<script>"));
    });

    it("buildTagSeo prefixes the tag name with # in the title", async () => {
      const seo = await buildTagSeo({ name: "Popularno", slug: "popularno", domain: "service" }, fakeReq());
      assert.match(seo.title, /^#Popularno/);
    });
  });

  describe("description fallback chain", () => {
    it("buildProductSeo prefers kratakOpis over dugiOpis", async () => {
      const seo = await buildProductSeo({ naziv: "X", slug: "x", kratakOpis: "Kratak", dugiOpis: "Dugi" }, fakeReq());
      assert.equal(seo.description, "Kratak");
    });

    it("buildProductSeo falls back to dugiOpis when kratakOpis is missing", async () => {
      const seo = await buildProductSeo({ naziv: "X", slug: "x", kratakOpis: "", dugiOpis: "Dugi opis proizvoda" }, fakeReq());
      assert.equal(seo.description, "Dugi opis proizvoda");
    });

    it("falls back to the site's default description as a last resort", async () => {
      const seo = await buildProductSeo({ naziv: "X", slug: "x" }, fakeReq(), { defaultDescription: "Default opis sajta" });
      assert.equal(seo.description, "Default opis sajta");
    });
  });

  describe("robots/noindex logic", () => {
    it("buildServiceSeo sets noindex when isIndexable is explicitly false", async () => {
      const seo = await buildServiceSeo({ naziv: "X", slug: "x", isIndexable: false }, fakeReq());
      assert.equal(seo.robots, "noindex, follow");
    });

    it("buildServiceSeo indexes by default (isIndexable undefined/true)", async () => {
      const seo = await buildServiceSeo({ naziv: "X", slug: "x" }, fakeReq());
      assert.equal(seo.robots, "index, follow");
    });

    it("buildCategorySeo respects both meta.isActive and isIndexable - noindex if either is false", async () => {
      const inactiveMeta = await buildCategorySeo({ name: "X", slug: "x", domain: "service", meta: { isActive: false } }, fakeReq());
      assert.equal(inactiveMeta.robots, "noindex, follow");

      const notIndexable = await buildCategorySeo({ name: "X", slug: "x", domain: "service", isIndexable: false }, fakeReq());
      assert.equal(notIndexable.robots, "noindex, follow");
    });

    it("buildExpertSeo sets noindex for an inactive expert", async () => {
      const seo = await buildExpertSeo({ firstName: "Ana", lastName: "Anic", slug: "ana", isActive: false }, fakeReq());
      assert.equal(seo.robots, "noindex, follow");
    });

    it("buildPageSeoWithReq respects the explicit noIndex flag", async () => {
      const seo = await buildPageSeoWithReq({ title: "Prodavnica", slug: "/prodavnica", noIndex: true }, fakeReq());
      assert.equal(seo.robots, "noindex, follow");
    });

    it("buildProductSeo and buildPostSeo always index (no draft/inactive concept at the SEO layer for these)", async () => {
      const product = await buildProductSeo({ naziv: "X", slug: "x" }, fakeReq());
      assert.equal(product.robots, "index, follow");
      const post = await buildPostSeo({ naslov: "X", slug: "x" }, fakeReq());
      assert.equal(post.robots, "index, follow");
    });
  });

  describe("image fallback chain", () => {
    it("buildProductSeo uses the product's own image, falling back to the site default", async () => {
      const withImage = await buildProductSeo({ naziv: "X", slug: "x", slika: { url: "/images/products/x.webp" } }, fakeReq());
      assert.equal(withImage.og.image, "/images/products/x.webp");

      const withoutImage = await buildProductSeo({ naziv: "X", slug: "x" }, fakeReq(), { defaultImage: "/images/site/og.webp" });
      assert.equal(withoutImage.og.image, "/images/site/og.webp");
    });
  });

  describe("post-specific: article metadata and keywords", () => {
    it("includes article publishedTime/author/section under og.article", async () => {
      const seo = await buildPostSeo(
        { naslov: "Naslov", slug: "naslov", datumObjave: "01.01.2026.", autor: { ime: "Ana Anic" }, kategorije: ["Nega lica"] },
        fakeReq()
      );
      assert.equal(seo.og.article.publishedTime, "01.01.2026.");
      assert.equal(seo.og.article.author, "Ana Anic");
      assert.equal(seo.og.article.section, "Nega lica");
    });

    it("joins keyword arrays into a comma-separated meta.keywords string", async () => {
      const seo = await buildPostSeo({ naslov: "X", slug: "x", seoKljucneReci: ["nega", "koza", "tretman"] }, fakeReq());
      assert.equal(seo.meta.keywords, "nega, koza, tretman");
    });

    it("produces an empty keywords string (not 'undefined') when there are none", async () => {
      const seo = await buildProductSeo({ naziv: "X", slug: "x" }, fakeReq());
      assert.equal(seo.meta.keywords, "");
    });
  });

  describe("Twitter card type varies by whether there's a real image", () => {
    it("uses summary_large_image for entities with photos (product/service/post/expert)", async () => {
      const seo = await buildProductSeo({ naziv: "X", slug: "x" }, fakeReq());
      assert.equal(seo.twitter.card, "summary_large_image");
    });

    it("uses plain summary for entities without photos (category/tag/generic page)", async () => {
      const seo = await buildTagSeo({ name: "X", slug: "x", domain: "service" }, fakeReq());
      assert.equal(seo.twitter.card, "summary");
    });
  });
});