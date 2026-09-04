import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderCampaignContentToEmailHtml } from "../../../src/utils/campaign-content.util.js";

const BASE_URL = "https://beautymedica.rs";

describe("campaign-content.util - renderCampaignContentToEmailHtml", () => {
  it("returns an empty string for empty/missing content, without throwing", () => {
    assert.equal(renderCampaignContentToEmailHtml([], BASE_URL), "");
    assert.equal(renderCampaignContentToEmailHtml(undefined, BASE_URL), "");
  });

  it("sorts blocks by order regardless of input order", () => {
    const html = renderCampaignContentToEmailHtml(
      [
        { type: "paragraph", text: "drugi", order: 2 },
        { type: "paragraph", text: "prvi", order: 1 },
      ],
      BASE_URL
    );
    assert.ok(html.indexOf("prvi") < html.indexOf("drugi"));
  });

  it("escapes HTML in paragraph/heading text so a subscriber can't inject markup through admin-entered content", () => {
    const html = renderCampaignContentToEmailHtml([{ type: "paragraph", text: "<script>alert(1)</script>", order: 0 }], BASE_URL);
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });

  it("renders a heading block at the requested level's style, defaulting to level 2 when unset", () => {
    const html = renderCampaignContentToEmailHtml([{ type: "heading", text: "Naslov", order: 0 }], BASE_URL);
    assert.ok(html.includes("Naslov"));
    assert.ok(html.includes("font-size:22px"));
  });

  it("skips an image block with no image set, rather than emitting a broken <img>", () => {
    const html = renderCampaignContentToEmailHtml([{ type: "image", order: 0 }], BASE_URL);
    assert.equal(html, "");
  });

  it("renders an image block's img/imgDesc as an absolute <img> src/alt", () => {
    const html = renderCampaignContentToEmailHtml([{ type: "image", image: { img: "/images/x.webp", imgDesc: "Opis" }, order: 0 }], BASE_URL);
    assert.ok(html.includes('src="https://beautymedica.rs/images/x.webp"'));
    assert.ok(html.includes('alt="Opis"'));
  });

  it("leaves an already-absolute image URL untouched instead of double-prefixing it", () => {
    const html = renderCampaignContentToEmailHtml([{ type: "image", image: { img: "https://cdn.example.com/x.webp", imgDesc: "" }, order: 0 }], BASE_URL);
    assert.ok(html.includes('src="https://cdn.example.com/x.webp"'));
  });

  for (const type of ["cta", "serviceReference", "productReference"]) {
    it(`renders a ${type} block's relative button.url as an absolute link`, () => {
      const html = renderCampaignContentToEmailHtml(
        [{ type, title: "Pogledaj", button: { url: "/usluge/masaza", text: "Zakaži" }, order: 0 }],
        BASE_URL
      );
      assert.ok(html.includes('href="https://beautymedica.rs/usluge/masaza"'));
      assert.ok(html.includes("Zakaži"));
    });

    it(`skips a ${type} block with no button.url set`, () => {
      const html = renderCampaignContentToEmailHtml([{ type, title: "Pogledaj", order: 0 }], BASE_URL);
      assert.equal(html, "");
    });
  }

  it("renders a divider as an <hr>", () => {
    const html = renderCampaignContentToEmailHtml([{ type: "divider", order: 0 }], BASE_URL);
    assert.ok(html.includes("<hr"));
  });

  it("REGRESSION: silently skips block types outside CAMPAIGN_BLOCK_TYPES (e.g. gallery/video/table) rather than throwing - the web-only content-blocks-render.ejs equivalents depend on Bootstrap CSS/icons that don't load in an email client", () => {
    const html = renderCampaignContentToEmailHtml(
      [
        { type: "gallery", gallery: [{ img: "/a.webp" }], order: 0 },
        { type: "video", video: { url: "https://youtube.com/x" }, order: 1 },
        { type: "paragraph", text: "ovo ostaje", order: 2 },
      ],
      BASE_URL
    );
    assert.equal(html, '<p style="font-size:15px; color:#3a352f; line-height:1.7; margin:0 0 16px;">ovo ostaje</p>');
  });
});
