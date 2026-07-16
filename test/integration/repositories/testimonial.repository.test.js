import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import testimonialRepo from "../../../src/repositories/testimonial.repository.js";
import "../../../src/models/service.model.js";
import "../../../src/models/package.model.js";
import "../../../src/models/user.model.js";

function validTestimonial(overrides = {}) {
  return {
    name: "Milica",
    rating: 5,
    message: "Odlicno iskustvo, toplo preporucujem svima.",
    status: "pending",
    ...overrides,
  };
}

describe("testimonial.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createTestimonial", () => {
    it("persists a testimonial", async () => {
      const testimonial = await testimonialRepo.createTestimonial(validTestimonial());
      assert.ok(testimonial._id);
      assert.equal(testimonial.status, "pending");
    });

    it("rejects a rating outside 1-5 at the schema level", async () => {
      await assert.rejects(() => testimonialRepo.createTestimonial(validTestimonial({ rating: 6 })));
    });

    it("rejects a message longer than 1000 characters", async () => {
      await assert.rejects(() => testimonialRepo.createTestimonial(validTestimonial({ message: "a".repeat(1001) })));
    });

    it("accepts a testimonial with no image at all (image is optional)", async () => {
      const testimonial = await testimonialRepo.createTestimonial(validTestimonial());
      assert.equal(testimonial.image, undefined);
    });

    it("rejects an image missing the required imgDesc field when one is provided", async () => {
      await assert.rejects(() =>
        testimonialRepo.createTestimonial(validTestimonial({ image: { img: "/images/testimonials/milica.webp" } }))
      );
    });
  });

  describe("findTestimonialById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await testimonialRepo.findTestimonialById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });
  });

  describe("findTestimonials", () => {
    it("filters by status", async () => {
      await testimonialRepo.createTestimonial(validTestimonial({ status: "pending" }));
      await testimonialRepo.createTestimonial(validTestimonial({ status: "approved" }));

      const result = await testimonialRepo.findTestimonials({ filters: { status: "approved" }, populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].status, "approved");
    });

    it("sorts featured testimonials first", async () => {
      await testimonialRepo.createTestimonial(validTestimonial({ name: "Ne-istaknuta", isFeatured: false }));
      await testimonialRepo.createTestimonial(validTestimonial({ name: "Istaknuta", isFeatured: true }));

      const result = await testimonialRepo.findTestimonials({ populateFields: [] });

      assert.equal(result.data[0].name, "Istaknuta");
    });

    it("filters by minRating", async () => {
      await testimonialRepo.createTestimonial(validTestimonial({ rating: 3 }));
      await testimonialRepo.createTestimonial(validTestimonial({ rating: 5 }));

      const result = await testimonialRepo.findTestimonials({ filters: { minRating: 5 }, populateFields: [] });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].rating, 5);
    });
  });

  describe("findApprovedTestimonials", () => {
    it("only returns approved testimonials", async () => {
      await testimonialRepo.createTestimonial(validTestimonial({ status: "pending" }));
      await testimonialRepo.createTestimonial(validTestimonial({ status: "approved" }));

      const result = await testimonialRepo.findApprovedTestimonials({});

      assert.equal(result.length, 1);
      assert.equal(result[0].status, "approved");
    });

    it("filters to featured-only when requested", async () => {
      await testimonialRepo.createTestimonial(validTestimonial({ status: "approved", isFeatured: false }));
      await testimonialRepo.createTestimonial(validTestimonial({ status: "approved", isFeatured: true }));

      const result = await testimonialRepo.findApprovedTestimonials({ featuredOnly: true });

      assert.equal(result.length, 1);
      assert.equal(result[0].isFeatured, true);
    });
  });

  describe("updateTestimonialById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await testimonialRepo.createTestimonial(validTestimonial());
      const updated = await testimonialRepo.updateTestimonialById(created._id, { status: "approved" });
      assert.equal(updated.status, "approved");
    });
  });

  describe("deleteTestimonialById", () => {
    it("deletes the testimonial", async () => {
      const created = await testimonialRepo.createTestimonial(validTestimonial());
      await testimonialRepo.deleteTestimonialById(created._id);
      const found = await testimonialRepo.findTestimonialById(created._id);
      assert.equal(found, null);
    });
  });

  describe("countTestimonials", () => {
    it("counts testimonials matching a filter", async () => {
      await testimonialRepo.createTestimonial(validTestimonial({ status: "pending" }));
      await testimonialRepo.createTestimonial(validTestimonial({ status: "approved" }));

      const count = await testimonialRepo.countTestimonials({ status: "approved" });

      assert.equal(count, 1);
    });
  });
});