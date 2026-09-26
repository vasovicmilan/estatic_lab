import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildLink, buildSiteUrl, resolveLinkTarget, LINK_ROUTES } from "../../../src/utils/link.builder.js";
import { runWithLinkContext } from "../../../src/utils/link-context.util.js";
import { linkContextMiddleware } from "../../../src/middlewares/link-context.middleware.js";
import BUSINESS from "../../../src/config/business.config.js";

const SITE = BUSINESS.siteUrl.replace(/\/+$/, "");
const FRONTEND = "https://app.example.test";

let savedFrontend;
let savedDefault;

beforeEach(() => {
  savedFrontend = process.env.FRONTEND_URL;
  savedDefault = process.env.LINKS_DEFAULT_TARGET;
  process.env.FRONTEND_URL = `${FRONTEND}/`;
  delete process.env.LINKS_DEFAULT_TARGET;
});

afterEach(() => {
  if (savedFrontend === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = savedFrontend;
  if (savedDefault === undefined) delete process.env.LINKS_DEFAULT_TARGET;
  else process.env.LINKS_DEFAULT_TARGET = savedDefault;
});

describe("link.builder - target resolution", () => {
  it("defaults to the website when there is no request context and no env default (cron jobs)", () => {
    assert.equal(resolveLinkTarget(), "web");
    assert.equal(buildLink("cart"), `${SITE}/korpa`);
  });

  it("uses LINKS_DEFAULT_TARGET for work with no request context", () => {
    process.env.LINKS_DEFAULT_TARGET = "frontend";
    assert.equal(resolveLinkTarget(), "frontend");
    assert.equal(buildLink("cart"), `${FRONTEND}/korpa`);
  });

  it("request context wins over the env default", () => {
    process.env.LINKS_DEFAULT_TARGET = "frontend";
    runWithLinkContext({ target: "web" }, () => {
      assert.equal(buildLink("cart"), `${SITE}/korpa`);
    });
  });

  it("an explicit target wins over the request context", () => {
    runWithLinkContext({ target: "frontend" }, () => {
      assert.equal(buildLink("cart", {}, { target: "web" }), `${SITE}/korpa`);
    });
  });

  it("falls back to the site origin when FRONTEND_URL is not set", () => {
    delete process.env.FRONTEND_URL;
    assert.equal(buildLink("cart", {}, { target: "frontend" }), `${SITE}/korpa`);
  });
});

describe("link.builder - links", () => {
  it("builds token links for both faces", () => {
    assert.equal(buildLink("verifyAccount", { token: "abc" }, { target: "web" }), `${SITE}/verifikacija/abc`);
    assert.equal(buildLink("verifyAccount", { token: "abc" }, { target: "frontend" }), `${FRONTEND}/verifikacija/abc`);
    assert.equal(buildLink("orderConfirm", { orderId: "o1", token: "t1" }, { target: "frontend" }), `${FRONTEND}/korpa/potvrda/o1/t1`);
  });

  it("maps the same action to each face's own route", () => {
    assert.equal(buildLink("adminAppointment", { id: "a1" }, { target: "web" }), `${SITE}/admin/termini/detalji/a1`);
    assert.equal(buildLink("adminAppointment", { id: "a1" }, { target: "frontend" }), `${FRONTEND}/admin/zakazivanja/a1`);
    assert.equal(buildLink("accountAppointments", {}, { target: "frontend" }), `${FRONTEND}/moj-nalog/zakazivanja`);
  });

  it("url-encodes path params", () => {
    assert.equal(buildLink("resetPassword", { token: "a/b c" }, { target: "web" }), `${SITE}/resetovanje-lozinke/a%2Fb%20c`);
  });

  it("degrades to the site root instead of throwing when a param is missing", () => {
    assert.equal(buildLink("adminOrder", {}, { target: "frontend" }), `${FRONTEND}/`);
  });

  it("throws for an unknown route name (a programming error)", () => {
    assert.throws(() => buildLink("nope"), /Unknown link route/);
  });

  it("every route defines both a web and a frontend variant with the same :params", () => {
    for (const [name, route] of Object.entries(LINK_ROUTES)) {
      assert.ok(route.web && route.frontend, `${name} needs both variants`);
      const params = (p) => (p.match(/:[A-Za-z]+/g) || []).sort().join(",");
      assert.equal(params(route.web), params(route.frontend), `${name}: :params must match between variants`);
    }
  });

  it("buildSiteUrl appends a query string and follows the request context", () => {
    runWithLinkContext({ target: "frontend" }, () => {
      assert.equal(buildSiteUrl("/usluge/masaza", { query: { code: "ABC 1" } }), `${FRONTEND}/usluge/masaza?code=ABC%201`);
      assert.equal(buildSiteUrl("/", { query: { code: "X" } }), `${FRONTEND}/?code=X`);
    });
  });
});

describe("link-context.middleware", () => {
  it("marks /api/* requests as frontend and everything else as web, for the rest of the chain", async () => {
    const seen = {};
    await new Promise((resolve) => {
      linkContextMiddleware({ originalUrl: "/api/v1/auth/register" }, {}, async () => {
        await Promise.resolve();
        seen.api = resolveLinkTarget();
        resolve();
      });
    });
    await new Promise((resolve) => {
      linkContextMiddleware({ originalUrl: "/prijava" }, {}, () => {
        setTimeout(() => {
          seen.web = resolveLinkTarget();
          resolve();
        }, 0);
      });
    });
    assert.equal(seen.api, "frontend");
    assert.equal(seen.web, "web");
  });

  it("does not leak the context outside the request", () => {
    linkContextMiddleware({ originalUrl: "/api/v1/x" }, {}, () => {});
    assert.equal(resolveLinkTarget(), "web");
  });
});
