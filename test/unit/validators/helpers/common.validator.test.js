import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeContentUrl, contentBlocksHaveSafeUrls } from "../../../../src/middlewares/validators/helpers/common.validator.js";

describe("isSafeContentUrl", () => {
  it("accepts http/https URLs", () => {
    assert.equal(isSafeContentUrl("http://example.com"), true);
    assert.equal(isSafeContentUrl("https://example.com/path?q=1"), true);
  });

  it("accepts mailto: and tel: URLs", () => {
    assert.equal(isSafeContentUrl("mailto:test@example.com"), true);
    assert.equal(isSafeContentUrl("tel:+381601234567"), true);
  });

  it("accepts a root-relative path", () => {
    assert.equal(isSafeContentUrl("/prodavnica/proizvod-1"), true);
  });

  it("rejects a protocol-relative URL", () => {
    assert.equal(isSafeContentUrl("//evil.com/x"), false);
  });

  it("rejects javascript: URLs", () => {
    assert.equal(isSafeContentUrl("javascript:alert(1)"), false);
    assert.equal(isSafeContentUrl("  javascript:alert(1)  "), false);
    assert.equal(isSafeContentUrl("JaVaScRiPt:alert(1)"), false);
  });

  it("rejects data: URLs", () => {
    assert.equal(isSafeContentUrl("data:text/html,<script>alert(1)</script>"), false);
  });

  it("rejects vbscript: URLs", () => {
    assert.equal(isSafeContentUrl("vbscript:msgbox(1)"), false);
  });

  it("rejects a bare relative path (ambiguous, not unambiguously safe)", () => {
    assert.equal(isSafeContentUrl("proizvod-1"), false);
  });

  it("rejects empty/non-string input", () => {
    assert.equal(isSafeContentUrl(""), false);
    assert.equal(isSafeContentUrl("   "), false);
    assert.equal(isSafeContentUrl(null), false);
    assert.equal(isSafeContentUrl(undefined), false);
  });
});

describe("contentBlocksHaveSafeUrls", () => {
  it("passes an empty/undefined value through", () => {
    assert.equal(contentBlocksHaveSafeUrls(undefined), true);
    assert.equal(contentBlocksHaveSafeUrls([]), true);
  });

  it("passes non-array input through (shape is isJsonArrayOrArray's job)", () => {
    assert.equal(contentBlocksHaveSafeUrls("not-json"), true);
    assert.equal(contentBlocksHaveSafeUrls({ not: "an array" }), true);
  });

  it("accepts blocks with safe button/video urls", () => {
    const blocks = [
      { type: "cta", button: { text: "Zakažite", url: "https://example.com/zakazivanje" } },
      { type: "video", video: { url: "/uploads/video.mp4" } },
    ];
    assert.equal(contentBlocksHaveSafeUrls(blocks), true);
  });

  it("accepts the same blocks as a JSON string (as sent by the admin form)", () => {
    const blocks = [{ type: "cta", button: { text: "Kupi", url: "https://example.com/prodavnica" } }];
    assert.equal(contentBlocksHaveSafeUrls(JSON.stringify(blocks)), true);
  });

  it("rejects a javascript: url in a cta block's button", () => {
    const blocks = [{ type: "cta", button: { text: "Klikni", url: "javascript:alert(1)" } }];
    assert.equal(contentBlocksHaveSafeUrls(blocks), false);
  });

  it("rejects a javascript: url in a serviceReference block's button", () => {
    const blocks = [{ type: "serviceReference", button: { text: "Vidi", url: "javascript:alert(document.cookie)" } }];
    assert.equal(contentBlocksHaveSafeUrls(blocks), false);
  });

  it("rejects a data: url in a video block", () => {
    const blocks = [{ type: "video", video: { url: "data:text/html,<script>alert(1)</script>" } }];
    assert.equal(contentBlocksHaveSafeUrls(blocks), false);
  });

  it("rejects a javascript: url found among otherwise-safe blocks", () => {
    const blocks = [
      { type: "paragraph", text: "Hello" },
      { type: "cta", button: { text: "Kupi", url: "https://example.com" } },
      { type: "productReference", button: { text: "Kupi", url: "javascript:alert(1)" } },
    ];
    assert.equal(contentBlocksHaveSafeUrls(blocks), false);
  });

  it("ignores blocks with no button/video field", () => {
    const blocks = [{ type: "heading", text: "Naslov", level: 2 }, { type: "divider" }];
    assert.equal(contentBlocksHaveSafeUrls(blocks), true);
  });
});
