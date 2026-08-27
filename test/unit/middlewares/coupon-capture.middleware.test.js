import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { couponCaptureMiddleware, getCapturedReferralCode } from "../../../src/middlewares/coupon-capture.middleware.js";

function fakeReqRes({ path = "/", query = {} } = {}) {
  const cookies = [];
  const req = { path, query, cookies: {} };
  const res = { cookie: (name, value, options) => cookies.push({ name, value, options }) };
  return { req, res, cookies };
}

describe("couponCaptureMiddleware", () => {
  it("captures a plausible referral code into a cookie", () => {
    const { req, res, cookies } = fakeReqRes({ query: { code: "ana10" } });
    couponCaptureMiddleware(req, res, () => {});
    assert.equal(cookies.length, 1);
    assert.equal(cookies[0].name, "referralCode");
    assert.equal(cookies[0].value, "ANA10"); // uppercased
  });

  it("REGRESSION: never captures the Google OAuth callback's own '?code=' authorization code as a referral code", () => {
    const googleAuthCode = "4/0ATSMZQDSJPF_O2RDS-ZXVOXCTFWA1KWRCQGZIANVHBXJT2QPORMGSVX2PLTXCH7_YGR98Q";
    const { req, res, cookies } = fakeReqRes({ path: "/prijava/google/callback", query: { code: googleAuthCode, scope: "email profile" } });
    couponCaptureMiddleware(req, res, () => {});
    assert.equal(cookies.length, 0);
  });

  it("REGRESSION: rejects an OAuth-shaped code even if it somehow appeared on a different path than the callback route", () => {
    // defense in depth - the shape check alone should catch this even without the path exclusion
    const googleAuthCode = "4/0ATSMZQDSJPF_O2RDS-ZXVOXCTFWA1KWRCQGZIANVHBXJT2QPORMGSVX2PLTXCH7_YGR98Q";
    const { req, res, cookies } = fakeReqRes({ path: "/", query: { code: googleAuthCode } });
    couponCaptureMiddleware(req, res, () => {});
    assert.equal(cookies.length, 0);
  });

  it("rejects a code containing a slash, regardless of length", () => {
    const { req, res, cookies } = fakeReqRes({ query: { code: "a/b" } });
    couponCaptureMiddleware(req, res, () => {});
    assert.equal(cookies.length, 0);
  });

  it("rejects a code longer than a plausible human-shared referral code", () => {
    const { req, res, cookies } = fakeReqRes({ query: { code: "a".repeat(40) } });
    couponCaptureMiddleware(req, res, () => {});
    assert.equal(cookies.length, 0);
  });

  it("does nothing (and never throws) when there's no ?code= at all", () => {
    const { req, res, cookies } = fakeReqRes();
    assert.doesNotThrow(() => couponCaptureMiddleware(req, res, () => {}));
    assert.equal(cookies.length, 0);
  });

  it("always calls next() exactly once, whether or not a code was captured", () => {
    let calls = 0;
    const { req, res } = fakeReqRes({ query: { code: "valid1" } });
    couponCaptureMiddleware(req, res, () => (calls += 1));
    assert.equal(calls, 1);

    const { req: req2, res: res2 } = fakeReqRes({ path: "/prijava/google/callback", query: { code: "4/0longcode" } });
    couponCaptureMiddleware(req2, res2, () => (calls += 1));
    assert.equal(calls, 2);
  });
});

describe("getCapturedReferralCode", () => {
  it("reads the cookie value when present", () => {
    const req = { cookies: { referralCode: "ANA10" } };
    assert.equal(getCapturedReferralCode(req), "ANA10");
  });

  it("returns null when the cookie is absent", () => {
    assert.equal(getCapturedReferralCode({ cookies: {} }), null);
    assert.equal(getCapturedReferralCode({}), null);
  });
});
