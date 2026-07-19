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

  describe("null safety", () => {
    it("returns null for a null testimonial across every single-item mapper", () => {
      assert.equal(mapTestimonialForAdminDetail(null), null);
      assert.equal(mapTestimonialForEdit(null), null);
      assert.equal(mapTestimonialForPublic(null), null);
    });
  });
});