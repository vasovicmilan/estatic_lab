import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildVCard, splitName } from "../../../src/utils/vcard.util.js";
import { normalizeSocialLink } from "../../../src/utils/social-link.util.js";

describe("vcard.util", () => {
  it("builds a 3.0 card with CRLF and only the fields that were given", () => {
    const text = buildVCard({ name: "Ana Marija Petrović", title: "Kozmetičar", org: "Estetik Lab", url: "https://x.rs/vizitka/abc" });
    assert.ok(text.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n"));
    assert.ok(text.includes("N:Petrović;Ana Marija;;;\r\n"));
    assert.ok(text.includes("FN:Ana Marija Petrović\r\n"));
    assert.ok(text.includes("TITLE:Kozmetičar\r\n"));
    assert.ok(!text.includes("TEL"));
    assert.ok(!text.includes("EMAIL"));
    assert.ok(text.endsWith("END:VCARD\r\n"));
  });

  it("includes phone and email when given and escapes special characters", () => {
    const text = buildVCard({ name: "A B", phone: "+381601234567", email: "a@b.rs", note: "linija1\nlinija2; tačka, zarez" });
    assert.ok(text.includes("TEL;TYPE=CELL:+381601234567"));
    assert.ok(text.includes("EMAIL;TYPE=INTERNET:a@b.rs"));
    assert.ok(text.includes("NOTE:linija1\\nlinija2\; tačka\\, zarez"));
  });

  it("splitName handles single names", () => {
    assert.deepEqual(splitName("Ana"), { first: "Ana", last: "" });
    assert.deepEqual(splitName(""), { first: "", last: "" });
  });
});

describe("social-link.util", () => {
  it("expands instagram handles and adds https", () => {
    assert.equal(normalizeSocialLink("instagram", "@estetik.lab"), "https://instagram.com/estetik.lab");
    assert.equal(normalizeSocialLink("website", "estetiklab.rs"), "https://estetiklab.rs/");
    assert.equal(normalizeSocialLink("facebook", "https://facebook.com/x"), "https://facebook.com/x");
  });

  it("rejects dangerous schemes and garbage", () => {
    assert.equal(normalizeSocialLink("website", "javascript:alert(1)"), null);
    assert.equal(normalizeSocialLink("website", "data:text/html,x"), null);
    assert.equal(normalizeSocialLink("website", "nemadomena"), null);
    assert.equal(normalizeSocialLink("website", ""), null);
  });
});
