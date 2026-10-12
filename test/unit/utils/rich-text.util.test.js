import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRichText } from "../../../src/utils/rich-text.util.js";

describe("sanitizeRichText", () => {
  it("keeps allowed formatting", () => {
    assert.equal(sanitizeRichText("<strong>a</strong> <em>b</em>"), "<strong>a</strong> <em>b</em>");
  });
  it("drops scripts and event handlers", () => {
    const out = sanitizeRichText(`<script>alert(1)</script><img src=x onerror=alert(1)><strong onclick="x()">ok</strong>`);
    assert.ok(!/<script|<img|onclick|onerror/i.test(out));
    assert.match(out, /<strong>ok<\/strong>/);
  });
  it("rejects javascript: links, keeps safe ones", () => {
    assert.equal(sanitizeRichText(`<a href="javascript:alert(1)">x</a>`), "<a>x</a>");
    assert.equal(sanitizeRichText(`<a href="/prodavnica">x</a>`), `<a href="/prodavnica">x</a>`);
    assert.match(sanitizeRichText(`<a href="https://a.rs">x</a>`), /rel="noopener noreferrer"/);
  });
  it("closes unclosed tags and escapes stray <", () => {
    assert.equal(sanitizeRichText("<strong>a"), "<strong>a</strong>");
    assert.equal(sanitizeRichText("1 < 2"), "1 &lt; 2");
    assert.equal(sanitizeRichText(null), "");
  });
});
