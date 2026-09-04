import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapTestimonialsForAdminList,
  mapTestimonialForAdminDetail,
  mapTestimonialForEdit,
  mapTestimonialForPublic,
} from "../../../src/mappers/testimonial.mapper.js";
import { buildTestimonial, buildUser, id } from "../../helpers/factories.js";

describe("testimonial.mapper", () => {
  describe("display name fallback chain: own name > linked user > 'Anonimno'", () => {
    it("prefers the testimonial's own name field when present", () => {
      const t = buildTestimonial({ name: "Petar Petrovic", user: buildUser({ firstName: "Nalog", lastName: "Ime" }) });
      assert.equal(mapTestimonialForPublic(t).ime, "Petar Petrovic");
    });

    it("falls back to the linked user's name when no own name is given", () => {
      const t = buildTestimonial({ name: "", user: buildUser({ firstName: "Ana", lastName: "Anic" }) });
      assert.equal(mapTestimonialForPublic(t).ime, "Ana Anic");
    });

    it("falls back to 'Anonimno' when there's neither a name nor a populated user", () => {
      const t = buildTestimonial({ name: "", user: null });
      assert.equal(mapTestimonialForPublic(t).ime, "Anonimno");
    });

    it("does not crash and falls back to 'Anonimno' when user is an unpopulated raw id", () => {
      const t = buildTestimonial({ name: "", user: id() });
      assert.equal(mapTestimonialForPublic(t).ime, "Anonimno");
    });
  });

  describe("star rendering", () => {
    it("renders filled and empty stars adding up to 5", () => {
      const t = buildTestimonial({ rating: 3 });
      const mapped = mapTestimonialForPublic(t);
      assert.equal(mapped.ocenaZvezdice, "★★★☆☆");
    });

    it("renders all filled stars for a 5-star rating", () => {
      assert.equal(mapTestimonialForPublic(buildTestimonial({ rating: 5 })).ocenaZvezdice, "★★★★★");
    });
  });

  describe("subject resolution (service/package/product - whichever is set)", () => {
    it("resolves a populated service", () => {
      const t = buildTestimonial({ service: { _id: id(), name: "Masaza", slug: "masaza" }, package: null, product: null });
      const mapped = mapTestimonialForAdminDetail(t);
      assert.equal(mapped.usluga.naziv, "Masaza");
      assert.equal(mapped.paket, null);
      assert.equal(mapped.proizvod, null);
    });

    it("falls back to just the raw id (no naziv/slug) when service isn't populated - doesn't show blank strings", () => {
      const serviceId = id();
      const t = buildTestimonial({ service: serviceId, package: null, product: null });
      const mapped = mapTestimonialForAdminDetail(t);
      assert.equal(mapped.usluga.id, serviceId.toString());
      assert.equal("naziv" in mapped.usluga, false, "an unpopulated ref must not silently show an empty-string naziv");
    });

    it("resolves a populated product (the subject added when the shop was built)", () => {
      const t = buildTestimonial({ service: null, package: null, product: { _id: id(), name: "ESMA Uređaj", slug: "esma-uredjaj" } });
      const mapped = mapTestimonialForAdminDetail(t);
      assert.equal(mapped.proizvod.naziv, "ESMA Uređaj");
    });

    it("the admin list's 'usluga' summary field picks whichever subject is actually set", () => {
      const withProduct = buildTestimonial({ service: null, package: null, product: { _id: id(), name: "ESMA Uređaj" } });
      const [mapped] = mapTestimonialsForAdminList([withProduct]);
      assert.equal(mapped.usluga, "ESMA Uređaj");
    });

    it("mapTestimonialForEdit flattens whichever subject to a plain id string", () => {
      const productId = id();
      const t = buildTestimonial({ service: null, package: null, product: productId });
      const mapped = mapTestimonialForEdit(t);
      assert.equal(mapped.product, productId.toString());
      assert.equal(mapped.service, null);
    });
  });

  describe("avatar resolution priority: own uploaded image > linked user's avatar > null", () => {
    it("prefers the testimonial's own image over the user's avatar", () => {
      const t = buildTestimonial({
        image: { img: "/images/testimonials/own.webp" },
        user: buildUser({ avatar: "/images/users/avatar.webp" }),
      });
      const mapped = mapTestimonialForPublic(t);
      assert.equal(mapped.slika.url, "/images/testimonials/own.webp");
    });

    it("falls back to the linked user's avatar when there's no own image", () => {
      const t = buildTestimonial({ image: null, user: buildUser({ avatar: "/images/users/avatar.webp" }) });
      const mapped = mapTestimonialForPublic(t);
      assert.equal(mapped.slika.url, "/images/users/avatar.webp");
    });

    it("is null when neither exists", () => {
      const t = buildTestimonial({ image: null, user: null });
      assert.equal(mapTestimonialForPublic(t).slika, null);
    });
  });

  describe("status translation", () => {
    it("translates pending/approved/rejected", () => {
      assert.equal(mapTestimonialForAdminDetail(buildTestimonial({ status: "pending" })).status.vrednost, "Na čekanju");
      assert.equal(mapTestimonialForAdminDetail(buildTestimonial({ status: "approved" })).status.vrednost, "Odobren");
      assert.equal(mapTestimonialForAdminDetail(buildTestimonial({ status: "rejected" })).status.vrednost, "Odbijen");
    });
  });

  describe("registrovaniKorisnik flag", () => {
    it("is true when a user is linked, regardless of populated state", () => {
      assert.equal(mapTestimonialForPublic(buildTestimonial({ user: id() })).registrovaniKorisnik, true);
      assert.equal(mapTestimonialForPublic(buildTestimonial({ user: null })).registrovaniKorisnik, false);
    });
  });

  describe("mapTestimonialsForAdminList", () => {
    it("filters out null entries", () => {
      assert.equal(mapTestimonialsForAdminList([buildTestimonial(), null]).length, 1);
    });

    it("truncates the comment preview to 100 characters", () => {
      const longMessage = "a".repeat(200);
      const [mapped] = mapTestimonialsForAdminList([buildTestimonial({ message: longMessage })]);
      assert.equal(mapped.komentar.length, 100);
    });
  });

  describe("GDPR saglasnost (consentGiven/consent)", () => {
    it("mapTestimonialForAdminDetail exposes saglasnost.data/kada/ip from consent", () => {
      const t = buildTestimonial({
        consentGiven: true,
        consent: { givenAt: new Date("2026-01-15T10:00:00Z"), ipAddress: "203.0.113.9", textVersion: "v1-2026-09" },
      });
      const mapped = mapTestimonialForAdminDetail(t);
      assert.equal(mapped.saglasnost.data, true);
      assert.equal(mapped.saglasnost.ip, "203.0.113.9");
      assert.ok(mapped.saglasnost.kada, "kada should be a formatted, non-empty date string");
    });

    it("mapTestimonialForAdminDetail reports saglasnost.data as false for a legacy testimonial with no consent recorded", () => {
      const t = buildTestimonial({ consentGiven: false, consent: { givenAt: null, ipAddress: null, textVersion: null } });
      const mapped = mapTestimonialForAdminDetail(t);
      assert.equal(mapped.saglasnost.data, false);
      assert.equal(mapped.saglasnost.kada, null);
      assert.equal(mapped.saglasnost.ip, null);
    });

    it("mapTestimonialForPublic never exposes the consent object (IP address is not public data)", () => {
      const t = buildTestimonial({ consent: { givenAt: new Date(), ipAddress: "203.0.113.9", textVersion: "v1" } });
      const mapped = mapTestimonialForPublic(t);
      assert.equal("consent" in mapped, false);
      assert.equal("consentGiven" in mapped, false);
      assert.equal(JSON.stringify(mapped).includes("203.0.113.9"), false, "public mapper output must never contain the submitter's IP address");
    });
  });

  describe("null safety", () => {
    it("returns null for a null testimonial across every single-item mapper", () => {
      assert.equal(mapTestimonialForAdminDetail(null), null);
      assert.equal(mapTestimonialForEdit(null), null);
      assert.equal(mapTestimonialForPublic(null), null);
    });
  });

  describe("GDPR consent (saglasnost)", () => {
    it("mapTestimonialForAdminDetail exposes consent status, timestamp and IP for moderation", () => {
      const t = buildTestimonial({
        consentGiven: true,
        consent: { givenAt: new Date("2026-09-01T10:00:00Z"), ipAddress: "203.0.113.9", textVersion: "v1-2026-09" },
      });
      const mapped = mapTestimonialForAdminDetail(t);
      assert.equal(mapped.saglasnost.data, true);
      assert.equal(mapped.saglasnost.ip, "203.0.113.9");
      assert.ok(mapped.saglasnost.kada, "givenAt must be formatted, not left as a raw Date");
    });

    it("mapTestimonialForAdminDetail flags missing consent as false, not throwing on a missing consent object", () => {
      const t = buildTestimonial({ consentGiven: false, consent: undefined });
      const mapped = mapTestimonialForAdminDetail(t);
      assert.equal(mapped.saglasnost.data, false);
      assert.equal(mapped.saglasnost.kada, null);
      assert.equal(mapped.saglasnost.ip, null);
    });

    it("mapTestimonialForPublic never exposes the consent object at all - no IP address on the public page", () => {
      const t = buildTestimonial({ consent: { givenAt: new Date(), ipAddress: "203.0.113.9", textVersion: "v1" } });
      const mapped = mapTestimonialForPublic(t);
      assert.equal("consent" in mapped, false);
      assert.equal("saglasnost" in mapped, false);
      assert.equal(JSON.stringify(mapped).includes("203.0.113.9"), false, "an IP address must never reach the public-facing payload");
    });
  });
});