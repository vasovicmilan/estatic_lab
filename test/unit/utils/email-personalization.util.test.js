import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { personalizeText } from "../../../src/utils/email-personalization.util.js";

describe("email-personalization.util", () => {
  it("fills {{ime}} with the first name", () => {
    assert.equal(personalizeText("Zdravo {{ime}}, ponuda je tu.", "Ana"), "Zdravo Ana, ponuda je tu.");
  });

  it("tolerates spaces and letter case inside the braces", () => {
    assert.equal(personalizeText("Zdravo {{ Ime }}!", "Ana"), "Zdravo Ana!");
  });

  it("drops the placeholder AND the space before it when there is no name and no fallback", () => {
    assert.equal(personalizeText("Zdravo {{ime}}, ponuda je tu.", null), "Zdravo, ponuda je tu.");
    assert.equal(personalizeText("Zdravo {{ime}}, ponuda je tu.", "   "), "Zdravo, ponuda je tu.");
  });

  it("uses the fallback word after | when there is no name", () => {
    assert.equal(personalizeText("Zdravo {{ime|prijatelju}}!", undefined), "Zdravo prijatelju!");
  });

  it("prefers the real name over the fallback", () => {
    assert.equal(personalizeText("Zdravo {{ime|prijatelju}}!", "Mina"), "Zdravo Mina!");
  });

  it("replaces every occurrence", () => {
    assert.equal(personalizeText("{{ime|Vi}} i opet {{ime|Vi}}", "Ana"), "Ana i opet Ana");
  });

  it("escapes the name in HTML mode, so a name can never inject markup", () => {
    assert.equal(personalizeText("<p>Zdravo {{ime}}</p>", '<script>alert("x")</script>', { html: true }), "<p>Zdravo &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>");
  });

  it("leaves plain text (subject) unescaped in text mode", () => {
    assert.equal(personalizeText("Za {{ime}} & tebe", "Ana"), "Za Ana & tebe");
  });

  it("returns text without a placeholder untouched, and tolerates non-strings", () => {
    assert.equal(personalizeText("Nema ničega", "Ana"), "Nema ničega");
    assert.equal(personalizeText(undefined, "Ana"), undefined);
    assert.equal(personalizeText("", "Ana"), "");
  });
});
