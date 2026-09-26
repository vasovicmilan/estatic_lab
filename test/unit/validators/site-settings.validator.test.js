import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateWorkingHoursUpdate, validateClosedDatesUpdate } from "../../../src/middlewares/validators/site-settings.validator.js";

const FULL_WEEK = [
  { day: "monday", isOpen: true, from: "09:00", to: "20:00" },
  { day: "tuesday", isOpen: true, from: "09:00", to: "20:00" },
  { day: "wednesday", isOpen: true, from: "09:00", to: "20:00" },
  { day: "thursday", isOpen: true, from: "09:00", to: "20:00" },
  { day: "friday", isOpen: true, from: "09:00", to: "20:00" },
  { day: "saturday", isOpen: true, from: "09:00", to: "13:00" },
  { day: "sunday", isOpen: false, from: "09:00", to: "20:00" },
];

describe("site-settings.validator", () => {
  describe("validateWorkingHoursUpdate", () => {
    it("accepts a well-formed 7-day schedule", async () => {
      const agent = buildValidatorHarness(validateWorkingHoursUpdate);
      const res = await agent.post("/test").send({ workingHours: FULL_WEEK });
      assert.equal(res.status, 200);
    });

    it("rejects a payload with fewer or more than 7 days", async () => {
      const agent = buildValidatorHarness(validateWorkingHoursUpdate);
      const res = await agent.post("/test").send({ workingHours: FULL_WEEK.slice(0, 6) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.workingHours);
    });

    it("rejects an invalid day name", async () => {
      const agent = buildValidatorHarness(validateWorkingHoursUpdate);
      const bad = FULL_WEEK.map((d, i) => (i === 0 ? { ...d, day: "funday" } : d));
      const res = await agent.post("/test").send({ workingHours: bad });
      assert.equal(res.status, 400);
    });

    it("rejects a malformed time string", async () => {
      const agent = buildValidatorHarness(validateWorkingHoursUpdate);
      const bad = FULL_WEEK.map((d, i) => (i === 0 ? { ...d, from: "9am" } : d));
      const res = await agent.post("/test").send({ workingHours: bad });
      assert.equal(res.status, 400);
    });

    it("rejects a missing workingHours field entirely", async () => {
      const agent = buildValidatorHarness(validateWorkingHoursUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
    });
  });

  describe("validateClosedDatesUpdate", () => {
    it("accepts a well-formed list, including an empty one", async () => {
      const agent = buildValidatorHarness(validateClosedDatesUpdate);
      let res = await agent.post("/test").send({ closedDates: [] });
      assert.equal(res.status, 200);

      res = await agent.post("/test").send({ closedDates: [{ date: "2026-01-01", reason: "Nova godina", recurringYearly: true }] });
      assert.equal(res.status, 200);
    });

    it("rejects a non-array closedDates", async () => {
      const agent = buildValidatorHarness(validateClosedDatesUpdate);
      const res = await agent.post("/test").send({ closedDates: "not-an-array" });
      assert.equal(res.status, 400);
    });

    it("rejects an invalid date string", async () => {
      const agent = buildValidatorHarness(validateClosedDatesUpdate);
      const res = await agent.post("/test").send({ closedDates: [{ date: "not-a-date" }] });
      assert.equal(res.status, 400);
    });

    it("rejects a reason longer than 200 characters", async () => {
      const agent = buildValidatorHarness(validateClosedDatesUpdate);
      const res = await agent.post("/test").send({ closedDates: [{ date: "2026-01-01", reason: "x".repeat(201) }] });
      assert.equal(res.status, 400);
    });
  });
});
