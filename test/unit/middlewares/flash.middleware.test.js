import { describe, it } from "node:test";
import assert from "node:assert/strict";
import flash from "../../../src/middlewares/flash.middleware.js";

function fakeReqRes() {
  const req = { session: {} };
  const res = {};
  return { req, res };
}

describe("flash middleware", () => {
  it("attaches a req.flash function", () => {
    const { req, res } = fakeReqRes();
    flash()(req, res, () => {});
    assert.equal(typeof req.flash, "function");
  });

  it("doesn't overwrite an existing req.flash if one is already attached", () => {
    const { req, res } = fakeReqRes();
    const existing = () => "already here";
    req.flash = existing;
    flash()(req, res, () => {});
    assert.equal(req.flash, existing);
  });

  it("calls next() exactly once", () => {
    const { req, res } = fakeReqRes();
    let calls = 0;
    flash()(req, res, () => {
      calls += 1;
    });
    assert.equal(calls, 1);
  });

  it("throws if the session doesn't exist", () => {
    const req = {}; // no session at all
    const res = {};
    flash()(req, res, () => {});
    assert.throws(() => req.flash("error", "test"), /requires sessions/);
  });

  describe("setting a message: req.flash(type, message)", () => {
    it("queues a single string message under the given type", () => {
      const { req, res } = fakeReqRes();
      flash()(req, res, () => {});

      req.flash("success", "Sačuvano");

      assert.deepEqual(req.session.flash.success, ["Sačuvano"]);
    });

    it("returns the new count for that type, matching connect-flash's own return value", () => {
      const { req, res } = fakeReqRes();
      flash()(req, res, () => {});

      const first = req.flash("error", "prva greška");
      const second = req.flash("error", "druga greška");

      assert.equal(first, 1);
      assert.equal(second, 2);
    });

    it("keeps different types independent of each other", () => {
      const { req, res } = fakeReqRes();
      flash()(req, res, () => {});

      req.flash("success", "ok");
      req.flash("error", "nije ok");

      assert.deepEqual(req.session.flash.success, ["ok"]);
      assert.deepEqual(req.session.flash.error, ["nije ok"]);
    });
  });

  describe("reading a message: req.flash(type)", () => {
    it("returns the queued messages for that type", () => {
      const { req, res } = fakeReqRes();
      flash()(req, res, () => {});
      req.flash("info", "obaveštenje");

      assert.deepEqual(req.flash("info"), ["obaveštenje"]);
    });

    it("clears the type after reading it - the whole point of a FLASH message", () => {
      const { req, res } = fakeReqRes();
      flash()(req, res, () => {});
      req.flash("warning", "pažnja");

      req.flash("warning"); // first read
      assert.deepEqual(req.flash("warning"), []); // second read - already cleared
    });

    it("returns an empty array (not undefined) for a type that was never set", () => {
      const { req, res } = fakeReqRes();
      flash()(req, res, () => {});

      assert.deepEqual(req.flash("success"), []);
    });
  });
});
