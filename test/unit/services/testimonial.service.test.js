import { describe, it } from "node:test";
import assert from "node:assert/strict";
import testimonialRepo from "../../../src/repositories/testimonial.repository.js";
import * as testimonialService from "../../../src/services/testimonial.service.js";
import { buildTestimonial, id } from "../../helpers/factories.js";

describe("testimonial.service", () => {
  describe("submitTestimonial", () => {
    it("rejects a rating outside 1-5", async () => {
      await assert.rejects(
        () => testimonialService.submitTestimonial({ name: "A", rating: 6, message: "Odlicno" }),
        (err) => err.statusCode === 400
      );
      await assert.rejects(
        () => testimonialService.submitTestimonial({ name: "A", rating: 0, message: "Odlicno" }),
        (err) => err.statusCode === 400
      );
    });

    it("always starts a new testimonial as pending, regardless of input", async (t) => {
      let payload;
      t.mock.method(testimonialRepo, "createTestimonial", async (data) => {
        payload = data;
        return { ...data, _id: id() };
      });

      await testimonialService.submitTestimonial({ name: "A", rating: 5, message: "Odlicno iskustvo", consentGiven: true });

      assert.equal(payload.status, "pending");
    });

    it("rejects a submission with no consentGiven (GDPR)", async () => {
      await assert.rejects(
        () => testimonialService.submitTestimonial({ name: "A", rating: 5, message: "Odlicno iskustvo" }),
        (err) => err.statusCode === 400
      );
    });

    it("stores the consent snapshot (givenAt/ipAddress) when consent is given", async (t) => {
      let payload;
      t.mock.method(testimonialRepo, "createTestimonial", async (data) => {
        payload = data;
        return { ...data, _id: id() };
      });

      await testimonialService.submitTestimonial({
        name: "A",
        rating: 5,
        message: "Odlicno iskustvo",
        consentGiven: true,
        consentIpAddress: "203.0.113.5",
      });

      assert.equal(payload.consentGiven, true);
      assert.ok(payload.consent.givenAt instanceof Date);
      assert.equal(payload.consent.ipAddress, "203.0.113.5");
    });
  });

  describe("approveTestimonial / rejectTestimonial", () => {
    it("approveTestimonial throws 404 for a nonexistent testimonial", async (t) => {
      t.mock.method(testimonialRepo, "updateTestimonialById", async () => null);
      await assert.rejects(() => testimonialService.approveTestimonial("missing"), (err) => err.statusCode === 404);
    });

    it("rejectTestimonial always clears isFeatured", async (t) => {
      const testimonial = buildTestimonial({ isFeatured: true });
      let payload;
      t.mock.method(testimonialRepo, "updateTestimonialById", async (tid, patch) => {
        payload = patch;
        return { ...testimonial, ...patch };
      });
      t.mock.method(testimonialRepo, "findTestimonialById", async () => ({ ...testimonial, ...payload }));

      await testimonialService.rejectTestimonial(testimonial._id.toString());

      assert.equal(payload.isFeatured, false);
      assert.equal(payload.status, "rejected");
    });
  });

  describe("deleteTestimonialById", () => {
    it("throws 404 for a nonexistent testimonial", async (t) => {
      t.mock.method(testimonialRepo, "findTestimonialById", async () => null);
      await assert.rejects(() => testimonialService.deleteTestimonialById("missing"), (err) => err.statusCode === 404);
    });
  });

  describe("getRatingSummary", () => {
    it("passes the entity filter through to the repository and returns its result as-is", async (t) => {
      const repoMock = t.mock.method(testimonialRepo, "getRatingSummary", async () => ({ average: 4.5, count: 8 }));
      const result = await testimonialService.getRatingSummary({ product: id() });
      assert.deepEqual(result, { average: 4.5, count: 8 });
      assert.equal(repoMock.mock.callCount(), 1);
    });
  });
});