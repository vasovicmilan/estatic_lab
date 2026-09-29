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

describe("rate limiter config", () => {
  it("counts per visitor when SSR secret matches, ignores X-Client-IP otherwise, never limits static files", async () => {
    process.env.NODE_ENV = "development"; // limiters are skipped in test env
    process.env.RATE_LIMIT_API_MAX = "2";
    process.env.SSR_SHARED_SECRET = "s3cret-s3cret";
    const mod = await import(`../../../src/middlewares/rate-limiter.middleware.js?x=${Date.now()}`);
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

    // static resources are never counted
    for (let i = 0; i < 6; i++) assert.equal(await hit(app, "/images/site/hero.avif"), 200);
    for (let i = 0; i < 6; i++) assert.equal(await hit(app, "/uploads/products/a"), 200);
  });
});
