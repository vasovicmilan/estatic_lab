import { describe, it } from "node:test";
import assert from "node:assert/strict";
import serviceService from "../../../src/services/service.service.js";
import expertService from "../../../src/services/expert.service.js";
import testimonialService from "../../../src/services/testimonial.service.js";
import postService from "../../../src/services/post.service.js";
import packageService from "../../../src/services/package.service.js";
import productService from "../../../src/services/product.service.js";
import contactService from "../../../src/services/contact.service.js";
import newsLetterService from "../../../src/services/news-letter.service.js";
import siteSettingsService from "../../../src/services/site-settings.service.js";
import * as indexService from "../../../src/services/index.service.js";

describe("index.service", () => {
  describe("getLandingPageData", () => {
    it("aggregates all seven sources and trims featured experts to the requested limit", async (t) => {
      t.mock.method(serviceService, "findHighlightedServices", async () => [{ id: "s1" }]);
      t.mock.method(expertService, "getActiveExperts", async () => [{ id: "e1" }, { id: "e2" }, { id: "e3" }]);
      t.mock.method(testimonialService, "getApprovedTestimonials", async () => [{ id: "t1" }]);
      t.mock.method(postService, "findPublishedPosts", async () => ({ data: [{ id: "p1" }] }));
      t.mock.method(packageService, "findActivePackages", async () => ({ data: [{ id: "pkg1" }] }));
      t.mock.method(siteSettingsService, "getHeroContent", async () => ({ image: "/images/site/hero-medium.webp", imageAlt: "" }));
      // "featured" is the same shop badge used elsewhere (see
      // index.service.js's own comment) - homepage products are just a
      // filtered listPublicProducts call, not a separate curated list.
      t.mock.method(productService, "listPublicProducts", async () => ({ data: [{ id: "prod1" }] }));

      const result = await indexService.getLandingPageData({ featuredExpertLimit: 2 });

      assert.equal(result.highlightedServices.length, 1);
      assert.equal(result.featuredExperts.length, 2, "should trim to featuredExpertLimit");
      assert.equal(result.testimonials.length, 1);
      assert.equal(result.latestPosts.length, 1);
      assert.equal(result.bestPackages.length, 1);
      assert.equal(result.featuredProducts.length, 1);
      assert.equal(result.heroContent.image, "/images/site/hero-medium.webp");
      assert.ok(result.seo.pageTitle);
    });

    it("requests products filtered by the 'featured' badge specifically", async (t) => {
      t.mock.method(serviceService, "findHighlightedServices", async () => []);
      t.mock.method(expertService, "getActiveExperts", async () => []);
      t.mock.method(testimonialService, "getApprovedTestimonials", async () => []);
      t.mock.method(postService, "findPublishedPosts", async () => ({ data: [] }));
      t.mock.method(packageService, "findActivePackages", async () => ({ data: [] }));
      t.mock.method(siteSettingsService, "getHeroContent", async () => ({}));
      const listMock = t.mock.method(productService, "listPublicProducts", async () => ({ data: [] }));

      await indexService.getLandingPageData({ featuredProductLimit: 4 });

      assert.equal(listMock.mock.calls.length, 1);
      assert.deepEqual(listMock.mock.calls[0].arguments[0], { filters: { badge: "featured" }, limit: 4 });
    });
  });

  describe("submission pass-throughs", () => {
    it("submitContactForm validates required fields before delegating", async () => {
      await assert.rejects(() => indexService.submitContactForm({}), (err) => err.statusCode === 400);
    });

    it("submitContactForm delegates to contactService.submitContact when valid", async (t) => {
      const submitMock = t.mock.method(contactService, "submitContact", async () => ({ message: "ok" }));
      await indexService.submitContactForm({ firstName: "A", email: "a@b.com", message: "Zdravo" }, { ip: "127.0.0.1" });
      assert.equal(submitMock.mock.calls.length, 1);
    });

    it("submitTestimonialForm validates rating and message before delegating", async () => {
      await assert.rejects(() => indexService.submitTestimonialForm({}), (err) => err.statusCode === 400);
    });

    it("submitNewsletterForm requires an email", async () => {
      await assert.rejects(() => indexService.submitNewsletterForm(), (err) => err.statusCode === 400);
    });

    it("submitNewsletterForm delegates to newsLetterService.subscribe", async (t) => {
      const subscribeMock = t.mock.method(newsLetterService, "subscribe", async () => ({ message: "ok" }));
      await indexService.submitNewsletterForm("a@b.com");
      assert.equal(subscribeMock.mock.calls.length, 1);
    });

    it("unsubscribeNewsletter requires a token", async () => {
      await assert.rejects(() => indexService.unsubscribeNewsletter(), (err) => err.statusCode === 400);
    });
  });
});