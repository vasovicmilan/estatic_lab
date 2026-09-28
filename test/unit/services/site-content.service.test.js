import { describe, it } from "node:test";
import assert from "node:assert/strict";
import siteContentRepo from "../../../src/repositories/site-content.repository.js";
import * as siteContentService from "../../../src/services/site-content.service.js";

/** Every getXxx() (see site-content.service.js's getSiteContent) reads the
 * full singleton and destructures every section, so a mock of
 * findOrCreateSiteContent must return the full shape even when a test only
 * cares about one section - this fills in the rest with harmless stubs. */
function fakeSiteContent(overrides = {}) {
  return {
    about: { intro: "Uvod", sections: [] },
    faq: { items: [] },
    privacyPolicy: { lastUpdated: "1.1.2026.", intro: "Uvod", sections: [] },
    termsAndConditions: { lastUpdated: "1.1.2026.", intro: "Uvod", sections: [] },
    partnership: { intro: "Uvod", steps: [], highlights: [] },
    homeIntro: { title: "T", lead: "L", who: "W", massages: [], packages: "P", closing: "C" },
    whyUs: [],
    teamIntro: { eyebrow: "E", title: "T", lead: "L", highlights: [] },
    ...overrides,
  };
}

/**
 * Covers the two things that actually changed when the admin editor moved
 * from a raw JSON textarea to the card-based `SectionsBuilder` (see
 * frontend-design-ux-backlog.md's prolaz 15): (1) the happy path still saves
 * exactly the shape the builder produces, and (2) the now-recursive
 * `requireSections`/`validateSectionShape` actually rejects malformed
 * `ContentSection[]` payloads instead of only checking each section has a
 * `title`. Every PUT route (admin-ops.routes.js's `/site-content/*`) is a
 * thin `makeSiteContentUpdateHandler` wrapper around one of these service
 * functions, so covering the service functions covers the routes' real logic
 * - the routes themselves are just permission-gating + req/res plumbing.
 */
describe("site-content.service", () => {
  describe("updateAbout - happy path", () => {
    it("saves a well-formed sections tree exactly as given", async (t) => {
      let saved;
      t.mock.method(siteContentRepo, "updateSiteContent", async (data) => {
        saved = data;
        return {};
      });
      t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => fakeSiteContent({ about: { intro: "Uvod", sections: saved.about.sections } }));

      const sections = [
        {
          title: "Naša priča",
          paragraphs: ["Prvi pasus.", "Drugi pasus."],
          list: ["Stavka 1", "Stavka 2"],
          closingParagraphs: ["Završni pasus."],
          subsections: [{ title: "Pod-sekcija", paragraphs: ["Pasus pod-sekcije."], list: [], closingParagraphs: [] }],
        },
      ];

      const result = await siteContentService.updateAbout({ intro: "Uvod", sections });
      assert.deepEqual(saved.about.sections, sections);
      assert.deepEqual(result.sections, sections);
    });

    it("accepts a section with no optional fields at all (just a title)", async (t) => {
      t.mock.method(siteContentRepo, "updateSiteContent", async () => ({}));
      t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => fakeSiteContent());

      await assert.doesNotReject(() => siteContentService.updateAbout({ intro: "Uvod", sections: [{ title: "Samo naslov" }] }));
    });
  });

  describe("updateAbout / updatePrivacyPolicy / updateTermsAndConditions - rejects malformed sections", () => {
    it("rejects a section missing a title", async () => {
      await assert.rejects(
        () => siteContentService.updateAbout({ intro: "Uvod", sections: [{ paragraphs: ["x"] }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a section whose title is an empty string", async () => {
      await assert.rejects(
        () => siteContentService.updateAbout({ intro: "Uvod", sections: [{ title: "   " }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a non-array `sections`", async () => {
      await assert.rejects(() => siteContentService.updateAbout({ intro: "Uvod", sections: "not-an-array" }), (err) => err.statusCode === 400);
    });

    it("rejects a section that isn't an object (e.g. a bare string slipped into the array)", async () => {
      await assert.rejects(
        () => siteContentService.updateAbout({ intro: "Uvod", sections: ["oops"] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects `paragraphs` that isn't an array", async () => {
      await assert.rejects(
        () => siteContentService.updateAbout({ intro: "Uvod", sections: [{ title: "X", paragraphs: "not-an-array" }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a `list` array containing a non-string entry", async () => {
      await assert.rejects(
        () => siteContentService.updateAbout({ intro: "Uvod", sections: [{ title: "X", list: ["fine", 42] }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects `subsections` that isn't an array", async () => {
      await assert.rejects(
        () => siteContentService.updateAbout({ intro: "Uvod", sections: [{ title: "X", subsections: "nope" }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a subsection missing a title (recursion into nested sections works)", async () => {
      await assert.rejects(
        () => siteContentService.updateAbout({ intro: "Uvod", sections: [{ title: "X", subsections: [{ paragraphs: ["y"] }] }] }),
        (err) => err.statusCode === 400
      );
    });

    it("same recursive validation applies to Privacy Policy and Terms (shared requireSections)", async () => {
      await assert.rejects(
        () => siteContentService.updatePrivacyPolicy({ lastUpdated: "1.1.2026.", intro: "Uvod", sections: [{ title: "" }] }),
        (err) => err.statusCode === 400
      );
      await assert.rejects(
        () => siteContentService.updateTermsAndConditions({ lastUpdated: "1.1.2026.", intro: "Uvod", sections: [{ title: "X", list: [null] }] }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("other sections - unchanged validation still passes", () => {
    it("updateFaq still accepts a well-formed items array", async (t) => {
      t.mock.method(siteContentRepo, "updateSiteContent", async () => ({}));
      t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => fakeSiteContent({ faq: { items: [{ pitanje: "P?", odgovor: "O." }] } }));
      await assert.doesNotReject(() => siteContentService.updateFaq({ items: [{ pitanje: "P?", odgovor: "O." }] }));
    });

    it("updateWhyUs still rejects an item missing text", async () => {
      await assert.rejects(
        () => siteContentService.updateWhyUs([{ icon: "bi-cpu", title: "Naslov" }]),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("updatePartnership - step `number` validation (landing/partnership.ejs prints it directly)", () => {
    it("saves well-formed steps (each with a numeric `number`) as given", async (t) => {
      let saved;
      t.mock.method(siteContentRepo, "updateSiteContent", async (data) => {
        saved = data;
        return {};
      });
      t.mock.method(siteContentRepo, "findOrCreateSiteContent", async () => fakeSiteContent({ partnership: saved.partnership }));

      const steps = [{ number: 1, title: "Korak 1", description: "Opis." }];
      const result = await siteContentService.updatePartnership({ intro: "Uvod", steps, highlights: ["Prednost"] });
      assert.deepEqual(result.steps, steps);
    });

    it("rejects a step missing `number`", async () => {
      await assert.rejects(
        () => siteContentService.updatePartnership({ intro: "Uvod", steps: [{ title: "Korak", description: "Opis." }], highlights: [] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a step whose `number` isn't numeric (e.g. a string slipped in from a form)", async () => {
      await assert.rejects(
        () => siteContentService.updatePartnership({ intro: "Uvod", steps: [{ number: "1", title: "Korak", description: "Opis." }], highlights: [] }),
        (err) => err.statusCode === 400
      );
    });
  });
});
