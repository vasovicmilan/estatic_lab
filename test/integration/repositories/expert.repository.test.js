import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import expertRepo from "../../../src/repositories/expert.repository.js";

function validExpert(overrides = {}) {
  return {
    firstName: "Ana",
    lastName: "Anic",
    slug: "ana-anic",
    image: { img: "/images/experts/ana.webp", imgDesc: "Ana Anic" },
    ...overrides,
  };
}

describe("expert.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createExpert", () => {
    it("persists an expert", async () => {
      const expert = await expertRepo.createExpert(validExpert());
      assert.ok(expert._id);
    });

    it("rejects a duplicate slug (unique index)", async () => {
      await expertRepo.createExpert(validExpert());
      await assert.rejects(() => expertRepo.createExpert(validExpert({ firstName: "Marko", lastName: "Markovic" })));
    });

    it("rejects an image missing the required imgDesc field", async () => {
      await assert.rejects(() =>
        expertRepo.createExpert(validExpert({ image: { img: "/images/experts/ana.webp" } }))
      );
    });
  });

  describe("findExpertById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await expertRepo.findExpertById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findExpertBySlug", () => {
    it("finds an expert by slug", async () => {
      await expertRepo.createExpert(validExpert());
      const found = await expertRepo.findExpertBySlug("ana-anic");
      assert.ok(found);
    });

    it("returns null for a nonexistent slug", async () => {
      const found = await expertRepo.findExpertBySlug("ne-postoji");
      assert.equal(found, null);
    });
  });

  describe("findExperts", () => {
    it("filters by isActive", async () => {
      await expertRepo.createExpert(validExpert({ slug: "aktivna", isActive: true }));
      await expertRepo.createExpert(validExpert({ slug: "neaktivna", isActive: false }));

      const result = await expertRepo.findExperts({ filters: { isActive: true }, populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "aktivna");
    });

    it("searches by firstName, lastName, or title", async () => {
      await expertRepo.createExpert(validExpert({ firstName: "Ana", lastName: "Anic", slug: "ana" }));
      await expertRepo.createExpert(validExpert({ firstName: "Marko", lastName: "Markovic", slug: "marko" }));

      const result = await expertRepo.findExperts({ search: "Ana", populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].slug, "ana");
    });
  });

  describe("findActiveExperts", () => {
    it("returns only active experts, ordered", async () => {
      await expertRepo.createExpert(validExpert({ slug: "b", isActive: true, order: 2 }));
      await expertRepo.createExpert(validExpert({ slug: "a", isActive: true, order: 1 }));
      await expertRepo.createExpert(validExpert({ slug: "neaktivan", isActive: false }));

      const result = await expertRepo.findActiveExperts();

      assert.equal(result.length, 2);
      assert.equal(result[0].slug, "a");
    });
  });

  describe("updateExpertById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await expertRepo.createExpert(validExpert());
      const updated = await expertRepo.updateExpertById(created._id, { title: "Senior Terapeut" });
      assert.equal(updated.title, "Senior Terapeut");
    });
  });

  describe("deleteExpertById", () => {
    it("deletes the expert", async () => {
      const created = await expertRepo.createExpert(validExpert());
      await expertRepo.deleteExpertById(created._id);
      const found = await expertRepo.findExpertById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countExperts", () => {
    it("counts experts matching a filter", async () => {
      await expertRepo.createExpert(validExpert({ slug: "a", isActive: true }));
      await expertRepo.createExpert(validExpert({ slug: "b", isActive: false }));

      const count = await expertRepo.countExperts({ isActive: true });

      assert.equal(count, 1);
    });
  });
});