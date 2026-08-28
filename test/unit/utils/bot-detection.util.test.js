import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLikelyBot } from "../../../src/utils/bot-detection.util.js";

describe("bot-detection.util", () => {
  describe("isLikelyBot", () => {
    it("returns false for a missing or empty User-Agent", () => {
      assert.equal(isLikelyBot(undefined), false);
      assert.equal(isLikelyBot(null), false);
      assert.equal(isLikelyBot(""), false);
    });

    it("returns false for real browser User-Agents", () => {
      assert.equal(
        isLikelyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"),
        false
      );
      assert.equal(
        isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"),
        false
      );
    });

    it("returns true for well-known crawler User-Agents", () => {
      assert.equal(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
      assert.equal(isLikelyBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"), true);
      assert.equal(isLikelyBot("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"), true);
      assert.equal(isLikelyBot("Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)"), true);
      assert.equal(isLikelyBot("facebookexternalhit/1.1"), true);
      assert.equal(isLikelyBot("curl/8.4.0"), true);
      assert.equal(isLikelyBot("python-requests/2.31.0"), true);
    });
  });
});
