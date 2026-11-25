import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalLimitExceeded } from "../../../src/middlewares/rate-limiter.middleware.js";

describe("globalLimitExceeded", () => {
  it("odgovara običnim tekstom 429 bez šablona i bez poziva sledećeg middleware-a", () => {
    const out = { headers: {} };
    const res = {
      status(c) { out.status = c; return this; },
      set(k, v) { out.headers[k] = v; return this; },
      type(t) { out.type = t; return this; },
      send(b) { out.body = b; return this; },
      render() { throw new Error("ne sme da se renderuje stranica"); },
    };
    globalLimitExceeded({}, res);
    assert.equal(out.status, 429);
    assert.match(out.type, /text\/plain/);
    assert.match(out.headers["Cache-Control"], /no-store/);
    assert.ok(out.body.length > 0);
  });
});
