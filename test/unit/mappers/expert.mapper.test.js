import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapExpertsForAdminList,
  mapExpertForAdminDetail,
  mapExpertForEdit,
  mapExpertForPublicCard,
  mapExpertForPublicDetail,
} from "../../../src/mappers/expert.mapper.js";
import { buildExpert, id } from "../../helpers/factories.js";

describe("expert.mapper", () => {
  describe("full name", () => {
    it("joins first and last name", () => {
      const mapped = mapExpertForPublicCard(buildExpert({ firstName: "Jovana", lastName: "Jovanovic" }));
      assert.equal(mapped.imePrezime, "Jovana Jovanovic");
    });

    it("falls back to 'Nepoznato' when both names are missing", () => {
      const mapped = mapExpertForPublicCard(buildExpert({ firstName: "", lastName: "" }));
      assert.equal(mapped.imePrezime, "Nepoznato");
    });
  });

  describe("service name resolution", () => {
    it("only includes populated services with an actual name", () => {
      const expert = buildExpert({ services: [{ _id: id(), name: "Masaza" }, id(), null] });
      const mapped = mapExpertForAdminDetail(expert);
      assert.deepEqual(mapped.usluge, ["Masaza"]);
    });

    it("returns an empty array when services isn't an array at all", () => {
      const expert = buildExpert({ services: undefined });
      const mapped = mapExpertForAdminDetail(expert);
      assert.deepEqual(mapped.usluge, []);
    });
  });

  describe("mapExpertForEdit - service id flattening", () => {
    it("flattens both populated and raw service refs to plain id strings", () => {
      const populated = { _id: id(), name: "Masaza" };
      const raw = id();
      const expert = buildExpert({ services: [populated, raw] });
      const mapped = mapExpertForEdit(expert);
      assert.equal(mapped.services[0], populated._id.toString());
      assert.equal(mapped.services[1], raw.toString());
    });
  });

  describe("image formatting", () => {
    it("maps gallery images to {url, alt} pairs", () => {
      const expert = buildExpert({ gallery: [{ img: "/images/experts/a.webp", imgDesc: "Slika A" }] });
      const mapped = mapExpertForAdminDetail(expert);
      assert.deepEqual(mapped.galerija[0], { url: "/images/experts/a.webp", alt: "Slika A" });
    });

    it("returns null for a missing main image", () => {
      const mapped = mapExpertForAdminDetail(buildExpert({ image: null }));
      assert.equal(mapped.slika, null);
    });
  });

  describe("public vs admin shape", () => {
    it("the public detail shape doesn't expose isActive/order (internal admin fields)", () => {
      const mapped = mapExpertForPublicDetail(buildExpert());
      assert.ok(!("isActive" in mapped));
      assert.ok(!("order" in mapped));
    });
  });

  describe("mapExpertsForAdminList", () => {
    it("filters out null entries", () => {
      assert.equal(mapExpertsForAdminList([buildExpert(), null]).length, 1);
    });

    it("shows the service count, not the full list", () => {
      const expert = buildExpert({ services: [id(), id(), id()] });
      const [mapped] = mapExpertsForAdminList([expert]);
      assert.equal(mapped.brojUsluga, 3);
    });
  });

  describe("null safety", () => {
    it("returns null for a null expert across every single-item mapper", () => {
      assert.equal(mapExpertForAdminDetail(null), null);
      assert.equal(mapExpertForEdit(null), null);
      assert.equal(mapExpertForPublicCard(null), null);
      assert.equal(mapExpertForPublicDetail(null), null);
    });
  });
});