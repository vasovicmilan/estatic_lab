import { describe, it } from "node:test";
import assert from "node:assert/strict";
import expertRepo from "../../../src/repositories/expert.repository.js";
import * as expertService from "../../../src/services/expert.service.js";
import { buildExpert, id } from "../../helpers/factories.js";

describe("expert.service", () => {
  describe("createExpert", () => {
    it("auto-generates a slug from the name when none is given", async (t) => {
      t.mock.method(expertRepo, "findExpertBySlug", async () => null); // slug is free
      let createdPayload;
      const created = buildExpert({ firstName: "Ana", lastName: "Anic", slug: undefined });
      t.mock.method(expertRepo, "createExpert", async (payload) => {
        createdPayload = payload;
        return { ...created, ...payload, _id: id() };
      });
      t.mock.method(expertRepo, "findExpertById", async () => ({ ...created, slug: createdPayload.slug }));

      await expertService.createExpert({ firstName: "Ana", lastName: "Anic", image: { img: "/x.webp" } });

      assert.equal(createdPayload.slug, "ana-anic");
    });

    it("resolves a slug collision by appending -2", async (t) => {
      let callCount = 0;
      t.mock.method(expertRepo, "findExpertBySlug", async (slug) => {
        callCount++;
        return slug === "ana-anic" ? buildExpert({ slug: "ana-anic" }) : null;
      });
      let created;
      t.mock.method(expertRepo, "createExpert", async (payload) => {
        created = { ...payload, _id: id() };
        return created;
      });
      t.mock.method(expertRepo, "findExpertById", async () => created);

      await expertService.createExpert({ firstName: "Ana", lastName: "Anic", image: { img: "/x.webp" } });

      assert.equal(created.slug, "ana-anic-2");
      assert.ok(callCount >= 2);
    });

    it("rejects an explicitly-chosen slug that's already taken", async (t) => {
      t.mock.method(expertRepo, "findExpertBySlug", async () => buildExpert({ slug: "zauzeto" }));
      await assert.rejects(
        () => expertService.createExpert({ firstName: "A", lastName: "B", slug: "zauzeto", image: { img: "/x.webp" } }),
        (err) => err.statusCode === 409
      );
    });

    it("requires an image", async () => {
      await assert.rejects(() => expertService.createExpert({ firstName: "A", lastName: "B" }), (err) => err.statusCode === 400);
    });
  });

  describe("getExpertBySlug", () => {
    it("treats an inactive expert as not found on the public site", async (t) => {
      t.mock.method(expertRepo, "findExpertBySlug", async () => buildExpert({ isActive: false }));
      await assert.rejects(() => expertService.getExpertBySlug("neaktivan"), (err) => err.statusCode === 404);
    });
  });

  describe("updateExpertById", () => {
    it("allows keeping your own slug (no false-positive conflict against yourself)", async (t) => {
      const expert = buildExpert({ slug: "moj-slug" });
      t.mock.method(expertRepo, "findExpertBySlug", async () => expert); // same record
      t.mock.method(expertRepo, "updateExpertById", async () => expert);
      t.mock.method(expertRepo, "findExpertById", async () => expert);

      await expertService.updateExpertById(expert._id.toString(), { slug: "moj-slug" });
    });

    it("rejects switching to a slug owned by a different expert", async (t) => {
      const other = buildExpert({ slug: "tudje" });
      t.mock.method(expertRepo, "findExpertBySlug", async () => other);
      await assert.rejects(
        () => expertService.updateExpertById(id().toString(), { slug: "tudje" }),
        (err) => err.statusCode === 409
      );
    });
  });

  describe("deleteExpertById", () => {
    it("throws 404 for a nonexistent expert", async (t) => {
      t.mock.method(expertRepo, "findExpertById", async () => null);
      await assert.rejects(() => expertService.deleteExpertById("missing"), (err) => err.statusCode === 404);
    });
  });
});