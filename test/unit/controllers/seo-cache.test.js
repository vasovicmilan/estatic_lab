import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { cachedSeoText, clearSeoCache } from "../../../src/controllers/web/seo.controller.js";

describe("cachedSeoText", () => {
  beforeEach(() => clearSeoCache());

  it("istovremeni i ponovljeni zahtevi dele jedan upit", async () => {
    let builds = 0;
    const build = async () => { builds += 1; await new Promise((r) => setTimeout(r, 10)); return "xml"; };
    const results = await Promise.all([cachedSeoText("k", build), cachedSeoText("k", build), cachedSeoText("k", build)]);
    assert.deepEqual(results, ["xml", "xml", "xml"]);
    assert.equal(await cachedSeoText("k", build), "xml");
    assert.equal(builds, 1);
  });

  it("različiti ključevi se prave posebno", async () => {
    let builds = 0;
    await cachedSeoText("a", async () => ++builds);
    await cachedSeoText("b", async () => ++builds);
    assert.equal(builds, 2);
  });

  it("neuspeh se ne pamti", async () => {
    let calls = 0;
    await assert.rejects(() => cachedSeoText("f", async () => { calls += 1; throw new Error("baza"); }), /baza/);
    assert.equal(await cachedSeoText("f", async () => { calls += 1; return "ok"; }), "ok");
    assert.equal(calls, 2);
  });
});
