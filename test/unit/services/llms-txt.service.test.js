import { describe, it } from "node:test";
import assert from "node:assert/strict";
import serviceService from "../../../src/services/service.service.js";
import packageService from "../../../src/services/package.service.js";
import postService from "../../../src/services/post.service.js";
import categoryService from "../../../src/services/category.service.js";
import { generateLlmsTxt } from "../../../src/services/llms-txt.service.js";

function mockAllSources(t, { services = [], packages = [], posts = [], categories = [] } = {}) {
  t.mock.method(serviceService, "findActiveServices", async () => ({ data: services }));
  t.mock.method(packageService, "findActivePackages", async () => ({ data: packages }));
  t.mock.method(postService, "findPublishedPosts", async () => ({ data: posts }));
  t.mock.method(categoryService, "getPublicCategories", async () => categories);
}

describe("llms-txt.service", () => {
  it("always includes the H1 title, summary blockquote, and contact line", async (t) => {
    mockAllSources(t, {});
    const output = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(output.startsWith("# Estetik Lab"));
    assert.ok(output.includes("> Estetik Lab wellness centar"));
    assert.ok(output.includes("estetik.lab.ns@gmail.com"));
  });

  it("always includes the static 'Ostalo' section and a sitemap.xml pointer", async (t) => {
    mockAllSources(t, {});
    const output = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(output.includes("## Ostalo"));
    assert.ok(output.includes("https://beautymedica.rs/sitemap.xml"));
  });

  it("lists each active service as a linked bullet with its short description", async (t) => {
    mockAllSources(t, { services: [{ naziv: "Tesla-Tone 24", slug: "tesla-tone-24", kratakOpis: "Miostimulacija." }] });
    const output = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(output.includes("## Usluge"));
    assert.ok(output.includes("- [Tesla-Tone 24](https://beautymedica.rs/usluge/tesla-tone-24): Miostimulacija."));
  });

  it("omits the Usluge section entirely when there are no active services, rather than an empty heading", async (t) => {
    mockAllSources(t, { services: [] });
    const output = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(!output.includes("## Usluge"));
  });

  it("includes package price alongside the link", async (t) => {
    mockAllSources(t, { packages: [{ naziv: "10 tretmana", slug: "10-tretmana", cena: "15000 RSD", kratakOpis: "Paket." }] });
    const output = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(output.includes("- [10 tretmana](https://beautymedica.rs/paketi/10-tretmana) - 15000 RSD: Paket."));
  });

  it("always includes the Prodavnica section with the full-catalog link, even with zero categories", async (t) => {
    mockAllSources(t, { categories: [] });
    const output = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(output.includes("## Prodavnica"));
    assert.ok(output.includes("Ceo katalog: https://beautymedica.rs/prodavnica"));
  });

  it("lists blog posts with links, and omits the section when there are none", async (t) => {
    mockAllSources(t, { posts: [{ naslov: "Kako radi miostimulacija", slug: "kako-radi", kratakOpis: "Objašnjenje." }] });
    const withPosts = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(withPosts.includes("- [Kako radi miostimulacija](https://beautymedica.rs/blog/kako-radi): Objašnjenje."));

    mockAllSources(t, { posts: [] });
    const withoutPosts = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(!withoutPosts.includes("## Blog"));
  });

  it("still returns a valid document when a data source throws", async (t) => {
    t.mock.method(serviceService, "findActiveServices", async () => {
      throw new Error("DB unavailable");
    });
    t.mock.method(packageService, "findActivePackages", async () => ({ data: [] }));
    t.mock.method(postService, "findPublishedPosts", async () => ({ data: [] }));
    t.mock.method(categoryService, "getPublicCategories", async () => []);

    const output = await generateLlmsTxt("https://beautymedica.rs");
    assert.ok(output.startsWith("# Estetik Lab"));
    assert.ok(!output.includes("## Usluge"));
  });
});