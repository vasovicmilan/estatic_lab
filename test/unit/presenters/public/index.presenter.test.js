import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prepareAboutPageData,
  preparePrivacyPolicyData,
  prepareTermsAndConditionsData,
  prepareHomeData,
  prepareContactPageData,
  preparePartnershipPageData,
} from "../../../../src/presenters/public/index.presenter.js";

describe("prepareAboutPageData", () => {
  it("returns a structured page with an intro and a non-empty list of sections", () => {
    const view = prepareAboutPageData();
    assert.equal(typeof view.intro, "string");
    assert.ok(view.intro.length > 0);
    assert.ok(Array.isArray(view.sections));
    assert.ok(view.sections.length > 0);
  });

  it("gives every section a title and either paragraphs or a list", () => {
    const view = prepareAboutPageData();
    for (const section of view.sections) {
      assert.equal(typeof section.title, "string");
      const content = section.paragraphs || section.list;
      assert.ok(Array.isArray(content) && content.length > 0, `section "${section.title}" needs either paragraphs or a list`);
    }
  });

  it("includes contact details for the business", () => {
    const view = prepareAboutPageData();
    assert.ok(view.contact);
  });
});

describe("preparePrivacyPolicyData", () => {
  it("returns a numbered list of legal sections, each with a title and either paragraphs or a list", () => {
    const view = preparePrivacyPolicyData();
    assert.ok(Array.isArray(view.sections));
    assert.ok(view.sections.length >= 10, "a real privacy policy needs to cover more than a handful of topics");

    for (const section of view.sections) {
      assert.equal(typeof section.title, "string");
      const content = section.paragraphs || section.list;
      assert.ok(Array.isArray(content) && content.length > 0, `section "${section.title}" needs either paragraphs or a list`);
    }
  });

  it("covers children's data specifically - a real legal requirement, not just generic filler", () => {
    const view = preparePrivacyPolicyData();
    assert.ok(view.sections.some((s) => /deca/i.test(s.title)));
  });
});

describe("prepareTermsAndConditionsData", () => {
  it("returns a numbered list of legal sections covering at least 15 distinct topics", () => {
    const view = prepareTermsAndConditionsData();
    assert.ok(Array.isArray(view.sections));
    assert.ok(view.sections.length >= 15);
  });

  it("specifies the governing law and jurisdiction - a required clause, not optional filler", () => {
    const view = prepareTermsAndConditionsData();
    assert.ok(view.sections.some((s) => /merodavno pravo/i.test(s.title)));
  });
});

describe("prepareHomeData", () => {
  it("passes each provided collection through unmodified, under its own key", () => {
    const highlightedServices = [{ id: "s1" }];
    const featuredExperts = [{ id: "e1" }];
    const testimonials = [{ id: "t1" }];
    const latestPosts = [{ id: "p1" }];
    const bestPackages = [{ id: "pkg1" }];

    const view = prepareHomeData({ highlightedServices, featuredExperts, testimonials, latestPosts, bestPackages });

    assert.equal(view.highlightedServices, highlightedServices);
    assert.equal(view.featuredExperts, featuredExperts);
    assert.equal(view.testimonials, testimonials);
    assert.equal(view.latestPosts, latestPosts);
    assert.equal(view.bestPackages, bestPackages);
  });

  it("defaults every collection to an empty array when nothing is passed", () => {
    const view = prepareHomeData();
    assert.deepEqual(view.highlightedServices, []);
    assert.deepEqual(view.featuredExperts, []);
    assert.deepEqual(view.testimonials, []);
    assert.deepEqual(view.latestPosts, []);
    assert.deepEqual(view.bestPackages, []);
  });

  it("points the hero CTA at the services page and the secondary CTA at packages", () => {
    const view = prepareHomeData();
    assert.equal(view.hero.ctaUrl, "/usluge");
    assert.equal(view.hero.secondaryCtaUrl, "/paketi");
  });

  it("points the testimonial submission form at the real endpoint", () => {
    const view = prepareHomeData();
    assert.equal(view.testimonialFormAction, "/testimonials/posalji");
  });
});

describe("prepareContactPageData", () => {
  it("includes contact details and a map with an address and embed URL", () => {
    const view = prepareContactPageData();
    assert.ok(view.contact);
    assert.ok(view.map.address);
    assert.ok(view.map.embedUrl);
  });

  it("has a single-level breadcrumb trail", () => {
    const view = prepareContactPageData();
    assert.equal(view.breadcrumbs.length, 1);
    assert.equal(view.breadcrumbs[0].label, "Kontakt");
  });
});

describe("preparePartnershipPageData", () => {
  it("walks through all 6 onboarding steps, numbered in order", () => {
    const view = preparePartnershipPageData();
    assert.equal(view.steps.length, 6);
    assert.deepEqual(
      view.steps.map((s) => s.number),
      [1, 2, 3, 4, 5, 6]
    );
  });

  it("every step has both a title and a description", () => {
    const view = preparePartnershipPageData();
    for (const step of view.steps) {
      assert.ok(step.title);
      assert.ok(step.description);
    }
  });

  it("includes contact details for partners who want to join", () => {
    const view = preparePartnershipPageData();
    assert.ok(view.contact);
  });
});