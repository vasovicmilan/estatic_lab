import { describe, it } from "node:test";
import assert from "node:assert/strict";
import siteContentRepo from "../../../src/repositories/site-content.repository.js";
import * as siteContentService from "../../../src/services/site-content.service.js";
import { DEFAULT_PAGE_SEO, PAGE_SEO_PAGES } from "../../../src/config/site-content-defaults.js";
import { buildApiPageSeo } from "../../../src/seo/index.js";
import { buildPageSeoWithReq } from "../../../src/seo/builders/page.builder.js";
import { buildSectionPayload } from "../../../src/controllers/web/admin/marketing/site-content.controller.js";
import { prepareSiteContentFormData } from "../../../src/presenters/admin/marketing/site-content.presenter.js";

describe("page SEO (DB is the single source of truth)", () => {
  it("defaults cover every page key", () => {
    assert.deepEqual(Object.keys(DEFAULT_PAGE_SEO).sort(), Object.keys(PAGE_SEO_PAGES).sort());
  });

  it("falls back to defaults for a document without pageSeo, and fills missing keys/empty fields", async (t) => {
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => ({ pageSeo: { faq: { title: "  ", description: "Moj opis", noIndex: true } } }));
    const all = await siteContentService.getPageSeoAll();
    assert.equal(all.faq.title, DEFAULT_PAGE_SEO.faq.title, "blank title -> default");
    assert.equal(all.faq.description, "Moj opis");
    assert.equal(all.faq.noIndex, true);
    assert.equal(all.home.title, DEFAULT_PAGE_SEO.home.title);
    assert.equal(all.home.path, "/");
  });

  it("getPageSeoConfig rejects unknown pages", async () => {
    await assert.rejects(() => siteContentService.getPageSeoConfig("nema-me"), (err) => err.statusCode === 400);
  });

  it("updatePageSeo saves trimmed values, keeps other pages and existing noIndex", async (t) => {
    let saved;
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => ({ pageSeo: { blog: { title: "Blog | X", description: "d", noIndex: true } } }));
    t.mock.method(siteContentRepo, "updateSiteContent", async (data) => {
      saved = data;
    });
    await siteContentService.updatePageSeo({ blog: { title: "  Novi blog  ", description: " Opis " } });
    assert.equal(saved.pageSeo.blog.title, "Novi blog");
    assert.equal(saved.pageSeo.blog.description, "Opis");
    assert.equal(saved.pageSeo.blog.noIndex, true, "noIndex untouched when not sent");
    assert.equal(saved.pageSeo.home.title, DEFAULT_PAGE_SEO.home.title, "other pages kept");
  });

  it("updatePageSeo validates key, required fields and length", async (t) => {
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => ({}));
    t.mock.method(siteContentRepo, "updateSiteContent", async () => {});
    const bad = (pages) => assert.rejects(() => siteContentService.updatePageSeo(pages), (err) => err.statusCode === 400);
    await bad({ nepoznato: { title: "a", description: "b" } });
    await bad({ home: { title: "", description: "b" } });
    await bad({ home: { title: "a", description: "" } });
    await bad({ home: { title: "x".repeat(121), description: "b" } });
    await bad({ home: { title: "a", description: "x".repeat(321) } });
    await bad(null);
  });

  it("getStaticPageSeo builds the EJS-shaped seo from the DB values", async (t) => {
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => ({ pageSeo: { about: { title: "O nama iz baze | Estetik Lab", description: "Opis iz baze" } } }));
    const seo = await siteContentService.getStaticPageSeo("about");
    assert.equal(seo.pageTitle, "O nama iz baze | Estetik Lab");
    assert.equal(seo.pageDescription, "Opis iz baze");
    assert.match(seo.canonical, /\/o-nama$/);
    assert.equal(seo.robots, "index, follow");
  });

  it("buildApiPageSeo returns the shape Angular's Seo.apply() needs, with a clean canonical", () => {
    const seo = buildApiPageSeo({ title: "Usluge | Estetik Lab", description: "Opis", path: "/usluge" });
    assert.match(seo.canonical, /^https?:\/\/[^?]+\/usluge$/);
    assert.equal(seo.robots, "index, follow");
    assert.deepEqual(seo.meta, {});
    assert.equal(seo.og.title, "Usluge | Estetik Lab");
    assert.equal(seo.twitter.card, "summary_large_image");
    assert.ok(Array.isArray(seo.jsonLd));
    assert.equal(seo.jsonLd[0]["@type"], "BreadcrumbList");
    assert.equal(buildApiPageSeo({ title: "X", description: "d", path: "/", noIndex: true }).robots, "noindex, follow");
    assert.equal(buildApiPageSeo({ title: "X", description: "d", path: "/" }).jsonLd.length, 0, "no breadcrumb on home");
  });

  it("page builder does not double the site name suffix", async () => {
    const req = { protocol: "https", get: () => "beautymedica.rs", query: {} };
    const a = await buildPageSeoWithReq({ title: "Usluge | Estetik Lab", description: "d", slug: "/usluge" }, req);
    const b = await buildPageSeoWithReq({ title: "Usluge", description: "d", slug: "/usluge" }, req);
    assert.equal(a.title, "Usluge | Estetik Lab");
    assert.equal(b.title, "Usluge | Estetik Lab");
  });

  it("admin form: payload builder <-> presenter round trip for the pageSeo section", () => {
    const body = {};
    for (const key of Object.keys(PAGE_SEO_PAGES)) {
      body[`${key}__title`] = ` T ${key} `;
      body[`${key}__description`] = `D ${key}`;
    }
    const payload = buildSectionPayload("pageSeo", body);
    assert.equal(payload.home.title, "T home");
    const form = prepareSiteContentFormData("pageSeo", payload);
    assert.equal(form.fields.length, Object.keys(PAGE_SEO_PAGES).length * 2);
    assert.equal(form.fields.find((f) => f.name === "faq__title").value, "T faq");
    assert.equal(form.fields.find((f) => f.name === "faq__description").value, "D faq");
  });
});

const FULL_DOC = { about: {}, faq: {}, privacyPolicy: {}, termsAndConditions: {}, partnership: {}, homeIntro: {}, whyUs: [], teamIntro: {} };

describe("listing intros, home hero and contact page (DB-backed content)", () => {
  it("getSiteContent fills every new section with defaults for an old document", async (t) => {
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => ({
      about: {}, faq: {}, privacyPolicy: {}, termsAndConditions: {}, partnership: {}, homeIntro: {}, whyUs: [], teamIntro: {},
    }));
    const c = await siteContentService.getSiteContent();
    assert.ok(c.homeHero.title && c.homeHero.ctaUrl);
    assert.ok(c.contactPage.mapEmbedUrl.startsWith("https://www.google.com/maps/embed"));
    assert.ok(c.servicesIntro.highlights.length > 0);
    assert.ok(c.packagesIntro.highlights.length > 0);
    assert.ok(c.blogIntro.highlights.length > 0);
    assert.ok(c.shopIntro.trust.length > 0 && c.shopIntro.faq.length > 0);
  });

  it("updateServicesIntro trims values and validates highlights", async (t) => {
    let saved;
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => FULL_DOC);
    t.mock.method(siteContentRepo, "updateSiteContent", async (d) => { saved = d; });
    await siteContentService.updateServicesIntro({
      eyebrow: " E ", title: "T", lead: "L", paragraphs: [" p1 ", "", "p2"], highlights: [{ icon: "bi-x", title: "a", text: "b" }],
    });
    assert.deepEqual(saved.servicesIntro.paragraphs, ["p1", "p2"]);
    assert.equal(saved.servicesIntro.eyebrow, "E");
    await assert.rejects(
      () => siteContentService.updateServicesIntro({ eyebrow: "E", title: "T", lead: "L", highlights: [{ icon: "", title: "", text: "b" }] }),
      (err) => err.statusCode === 400
    );
  });

  it("updateShopIntro requires question and answer for every FAQ row", async (t) => {
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => FULL_DOC);
    t.mock.method(siteContentRepo, "updateSiteContent", async () => {});
    await assert.rejects(
      () => siteContentService.updateShopIntro({ eyebrow: "E", title: "T", lead: "L", trust: [], faq: [{ pitanje: "P", odgovor: "" }] }),
      (err) => err.statusCode === 400
    );
  });

  it("updateContactPage only accepts Google Maps embed links (or empty)", async (t) => {
    let saved;
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => FULL_DOC);
    t.mock.method(siteContentRepo, "updateSiteContent", async (d) => { saved = d; });
    const base = { eyebrow: "E", title: "T", lead: "L", mapAddress: "A", googleDataNotice: "N" };
    await assert.rejects(() => siteContentService.updateContactPage({ ...base, mapEmbedUrl: "https://evil.example/x" }), (err) => err.statusCode === 400);
    await siteContentService.updateContactPage({ ...base, mapEmbedUrl: "" });
    assert.equal(saved.contactPage.mapEmbedUrl, "");
    await siteContentService.updateContactPage({ ...base, mapEmbedUrl: "https://www.google.com/maps/embed?pb=1" });
    assert.match(saved.contactPage.mapEmbedUrl, /maps\/embed/);
  });

  it("updateHomeHero requires all fields", async (t) => {
    t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => FULL_DOC);
    t.mock.method(siteContentRepo, "updateSiteContent", async () => {});
    await assert.rejects(() => siteContentService.updateHomeHero({ eyebrow: "E", title: "T" }), (err) => err.statusCode === 400);
  });

  it("web admin payload builders produce what the services accept", () => {
    const shop = buildSectionPayload("shopIntro", {
      eyebrow: "E", title: "T", lead: "L", paragraphs: "a\nb",
      trust: JSON.stringify([{ icon: "bi-x", title: "t", text: "x" }]),
      faq: JSON.stringify([{ pitanje: "p", odgovor: "o" }]),
    });
    assert.deepEqual(shop.paragraphs, ["a", "b"]);
    assert.equal(shop.trust.length, 1);
    assert.equal(shop.faq[0].pitanje, "p");
    const hero = buildSectionPayload("homeHero", { eyebrow: "e", title: "t", subtitle: "s", ctaLabel: "c", ctaUrl: "/u", secondaryCtaLabel: "c2", secondaryCtaUrl: "/p" });
    assert.equal(hero.ctaUrl, "/u");
  });
});
