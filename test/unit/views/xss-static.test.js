import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const VIEWS = path.resolve("src/views");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".ejs") ? [p] : [];
  });
}

const files = walk(VIEWS).map((f) => ({ f, src: fs.readFileSync(f, "utf8") }));

describe("view templates - output safety scans", () => {
  it("no raw JSON.stringify output (<%- JSON.stringify) anywhere", () => {
    const bad = files.filter(({ src }) => /<%-\s*JSON\.stringify/.test(src)).map(({ f }) => path.relative(VIEWS, f));
    assert.deepEqual(bad, []);
  });

  it("no raw output inside an HTML attribute value", () => {
    const re = /=\s*(["'])[^"'<>]*<%-[^%]*%>/;
    const bad = files.filter(({ src }) => re.test(src)).map(({ f }) => path.relative(VIEWS, f));
    assert.deepEqual(bad, []);
  });

  it("admin details view escapes row.value and only prints row.html raw", () => {
    const src = fs.readFileSync(path.join(VIEWS, "admin/_details.ejs"), "utf8");
    assert.ok(!/<%-\s*row\.value/.test(src));
    assert.match(src, /<%-\s*row\.html/);
  });
});
