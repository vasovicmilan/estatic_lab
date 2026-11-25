import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { csrfLocals, csrfTokenEndpoint } from "../../../src/config/csrf.config.js";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";

function run({ session = {}, ua = CHROME, url = "/" } = {}) {
  const req = { originalUrl: url, session, get: (h) => (h.toLowerCase() === "user-agent" ? ua : undefined) };
  const res = { locals: {} };
  let called = false;
  csrfLocals(req, res, () => (called = true));
  return { req, res, called };
}

describe("csrfLocals: token se pravi tek kad zatreba", () => {
  it("ne dira sesiju dok se token ne ispiše", () => {
    const { req, res, called } = run();
    assert.equal(called, true);
    assert.deepEqual(req.session, {});
    assert.ok(res.locals.csrfToken);
    assert.equal(res.locals.csrfTokenSoft, "");
    assert.deepEqual(req.session, {});
  });

  it("pri ispisu pravi token, upisuje ga u sesiju i uvek vraća isti", () => {
    const { req, res } = run();
    const first = `${res.locals.csrfToken}`;
    assert.ok(first.length > 10);
    assert.equal(req.session.csrfToken, first);
    assert.equal(`${res.locals.csrfToken}`, first);
  });

  it("anonimni posetilac sa već postojećim tokenom u sesiji ga dobija i za meta tag/podnožje", () => {
    const { res } = run({ session: { csrfToken: "vec-postoji" } });
    assert.equal(res.locals.csrfTokenSoft, "vec-postoji");
  });

  it("prijavljen korisnik dobija pravi token i u meta tagu", () => {
    const { req, res } = run({ session: { isLoggedIn: true } });
    const soft = `${res.locals.csrfTokenSoft}`;
    assert.ok(soft.length > 10);
    assert.equal(req.session.csrfToken, soft);
  });

  it("prepoznat bot ne dobija token ni sesiju", () => {
    const { req, res } = run({ ua: "Mozilla/5.0 (compatible; Googlebot/2.1)" });
    assert.equal(res.locals.csrfToken, "");
    assert.equal(res.locals.csrfTokenSoft, "");
    assert.deepEqual(req.session, {});
  });

  it("/api se preskače", () => {
    const { res } = run({ url: "/api/v1/x" });
    assert.equal(res.locals.csrfToken, undefined);
  });

  it("JSON.stringify daje običan string", () => {
    const { res } = run();
    assert.equal(typeof JSON.parse(JSON.stringify({ t: res.locals.csrfToken })).t, "string");
  });
});

describe("csrfTokenEndpoint", () => {
  function call(session) {
    const out = { headers: {} };
    const res = {
      set(k, v) { out.headers[k] = v; return this; },
      status(c) { out.status = c; return this; },
      json(b) { out.body = b; return this; },
    };
    csrfTokenEndpoint({ session }, res);
    return out;
  }

  it("vraća token bez keširanja", () => {
    const session = {};
    const out = call(session);
    assert.equal(out.body.success, true);
    assert.equal(out.body.token, session.csrfToken);
    assert.match(out.headers["Cache-Control"], /no-store/);
  });

  it("503 ako nema sesije", () => {
    assert.equal(call(undefined).status, 503);
  });
});
