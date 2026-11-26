import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

async function hit(app, path, headers = {}) {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  try {
    return await new Promise((resolve, reject) => {
      http.get({ port, path, headers }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); }).on("error", reject);
    });
  } finally {
    server.close();
  }
}

// svaki poziv uvozi svežu kopiju modula: prazni brojači i vrednosti iz process.env koje test zada
let copy = 0;
async function loadLimiters(env) {
  process.env.NODE_ENV = "development"; // limiters are skipped in test env
  Object.assign(process.env, env);
  return import(`../../../src/middlewares/rate-limiter.middleware.js?x=${Date.now()}-${copy++}`);
}

function appWith(limiter) {
  const app = express();
  app.use(limiter);
  app.use((req, res) => res.send("ok"));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).end());
  return app;
}

describe("rate limiter config", () => {
  it("counts per visitor when SSR secret matches, ignores X-Client-IP otherwise", async () => {
    const mod = await loadLimiters({ RATE_LIMIT_API_MAX: "2", SSR_SHARED_SECRET: "s3cret-s3cret" });
    const app = express();
    app.use(mod.apiLimiter);
    app.get("/{*splat}", (req, res) => res.send("ok"));

    const ssr = (ip) => ({ "x-ssr-secret": "s3cret-s3cret", "x-client-ip": ip });
    // two visitors behind the same SSR server get separate buckets
    for (let i = 0; i < 2; i++) assert.equal(await hit(app, "/api/v1/x", ssr("1.1.1.1")), 200);
    assert.equal(await hit(app, "/api/v1/x", ssr("1.1.1.1")), 429);
    assert.equal(await hit(app, "/api/v1/x", ssr("2.2.2.2")), 200);

    // spoofed header without the secret is ignored: counted by connection IP, shared bucket
    for (let i = 0; i < 2; i++) await hit(app, "/api/v1/y", { "x-client-ip": "9.9.9.9" });
    assert.equal(await hit(app, "/api/v1/y", { "x-client-ip": "8.8.8.8" }), 429);

  });

  // Regresija: izuzetak po ekstenziji je puštao svaki izmišljeni "fajl" bez ikakvog limita.
  it("counts made-up file paths - an extension or a static-looking prefix is not an exemption", async () => {
    const mod = await loadLimiters({ RATE_LIMIT_GLOBAL_MAX: "3", RATE_LIMIT_API_MAX: "3" });
    for (const [limiter, paths] of [
      [mod.globalLimiter, ["/blog/x.txt", "/korpa.xml", "/images/nema-me", "/uploads/a.json", "/api/nepostoji", "/api/v1x/a", "/uputstva/video/x.txt", "/uputstva/poster/a/b/c/d.jpg"]],
      [mod.apiLimiter, ["/api/v1/services/x.json"]],
    ]) {
      const app = appWith(limiter);
      for (let i = 0; i < 3; i++) assert.equal(await hit(app, paths[i % paths.length]), 200);
      for (const p of paths) assert.equal(await hit(app, p), 429, p);
    }
  });

  it("leaves /api/v1 to apiLimiter so one API call is not counted twice", async () => {
    const mod = await loadLimiters({ RATE_LIMIT_GLOBAL_MAX: "2" });
    const app = appWith(mod.globalLimiter);
    for (const p of ["/api/v1", "/api/v1/services", "/API/V1/services", "/api/v1?x=1"]) {
      for (let i = 0; i < 3; i++) assert.equal(await hit(app, p), 200, p);
    }
  });

  it("gives tutorial posters and videos their own, higher quota - not an unlimited one", async () => {
    const mod = await loadLimiters({ RATE_LIMIT_GLOBAL_MAX: "2", RATE_LIMIT_MEDIA_MAX: "6" });
    const app = appWith(mod.globalLimiter);
    for (let i = 0; i < 3; i++) assert.equal(await hit(app, "/uputstva/poster/pregled-sajta/desktop.jpg"), 200);
    for (let i = 0; i < 3; i++) assert.equal(await hit(app, "/uputstva/video/pregled-sajta/mobile/sr.mp4"), 200);
    assert.equal(await hit(app, "/uputstva/video/pregled-sajta/mobile/sr.mp4"), 429);
    // media requests did not spend the visitor's normal page budget
    for (let i = 0; i < 2; i++) assert.equal(await hit(app, "/uputstva"), 200);
    assert.equal(await hit(app, "/uputstva"), 429);
  });
});
