import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wrapError, AppError, notFound } from "../../../src/utils/error.util.js";

// Mirrors exactly what csrf-sync throws under the hood (see node_modules/
// csrf-sync -> createHttpError(403, "invalid csrf token", { code:
// "EBADCSRFTOKEN" })) - built by hand here rather than importing http-errors
// directly, since that's only csrf-sync's transitive dependency, not this
// project's own - a shape check on wrapError shouldn't depend on it.
function fakeCsrfError() {
  const err = new Error("invalid csrf token");
  err.statusCode = 403;
  err.code = "EBADCSRFTOKEN";
  return err;
}

describe("error.util - wrapError", () => {
  describe("CSRF token mismatch (csrf-sync's EBADCSRFTOKEN)", () => {
    it("marks it isOperational, so globalErrorHandler treats it as routine (not a Telegram-worthy error)", () => {
      // A well-formed 403 from a scanner probing a random path with no real
      // token, or a real visitor's stale tab after a session refresh. Neither
      // is an application bug, so it must NOT fall into the same
      // isOperational: false bucket as a genuinely unexpected error.
      const wrapped = wrapError(fakeCsrfError());

      assert.equal(wrapped.statusCode, 403);
      assert.equal(wrapped.isOperational, true);
    });

    it("gives a real visitor a sensible Serbian message instead of the generic 'Interna greška servera'", () => {
      const wrapped = wrapError(fakeCsrfError());

      assert.match(wrapped.message, /osveži|istekla/i);
    });
  });

  it("still treats an already-thrown AppError as-is (e.g. notFound) - not re-wrapped", () => {
    let thrown;
    try {
      notFound("Termin");
    } catch (error) {
      thrown = error;
    }

    const wrapped = wrapError(thrown);
    assert.equal(wrapped, thrown);
    assert.equal(wrapped.isOperational, true);
  });

  it("still treats a genuinely unexpected error (e.g. a raw DB error) as non-operational", () => {
    const dbError = new Error("connection timeout");
    const wrapped = wrapError(dbError);

    assert.equal(wrapped.isOperational, false);
    assert.equal(wrapped.message, "Interna greška servera");
    assert.ok(wrapped instanceof AppError);
  });
});
