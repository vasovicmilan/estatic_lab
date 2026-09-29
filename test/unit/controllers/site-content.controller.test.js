import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSectionPayload } from "../../../src/controllers/web/admin/marketing/site-content.controller.js";

describe("site-content.controller buildSectionPayload", () => {
  it("about: parses the JSON sections field, splits line fields and drops empty rows/lines", () => {
    const payload = buildSectionPayload("about", {
      intro: "  Uvod  ",
      sections: JSON.stringify([
        { title: " Naslov ", paragraphs: "Prvi\n\n  Drugi  ", list: [" a ", "", "b"], closingParagraphs: [""], subsections: [] },
        { title: "", paragraphs: [], list: [], closingParagraphs: [], subsections: [] },
      ]),
    });

    assert.deepEqual(payload, { intro: "Uvod", sections: [{ title: "Naslov", paragraphs: ["Prvi", "Drugi"], list: ["a", "b"] }] });
  });

  it("sections: the client may send line fields as textarea strings or arrays", () => {
    const payload = buildSectionPayload("privacyPolicy", {
      lastUpdated: "1. januar",
      intro: "i",
      sections: JSON.stringify([
        {
          title: "S",
          paragraphs: "jedan\ndva",
          subsections: [{ title: "Pod", paragraphs: ["x"], subsections: [{ title: "predubok" }] }],
        },
      ]),
    });

    assert.deepEqual(payload.sections, [{ title: "S", paragraphs: ["jedan", "dva"], subsections: [{ title: "Pod", paragraphs: ["x"] }] }]);
  });

  it("keeps a section that has content but no title, so the service can reject it with a readable message", () => {
    const payload = buildSectionPayload("about", { intro: "i", sections: [{ title: "", paragraphs: ["tekst"] }] });
    assert.deepEqual(payload.sections, [{ title: "", paragraphs: ["tekst"] }]);
  });

  it("faq: keeps only pitanje/odgovor, trimmed, and drops fully empty rows", () => {
    const payload = buildSectionPayload("faq", {
      items: JSON.stringify([
        { pitanje: " P? ", odgovor: " O ", extra: "ignored" },
        { pitanje: "", odgovor: "" },
      ]),
    });
    assert.deepEqual(payload, { items: [{ pitanje: "P?", odgovor: "O" }] });
  });

  it("partnership: step numbers come from the order, highlights are one per line", () => {
    const payload = buildSectionPayload("partnership", {
      intro: "i",
      steps: JSON.stringify([
        { title: "A", description: "a" },
        { title: "B", description: "b" },
      ]),
      highlights: "prva\r\n\r\ndruga\n",
    });
    assert.deepEqual(payload.steps, [
      { number: 1, title: "A", description: "a" },
      { number: 2, title: "B", description: "b" },
    ]);
    assert.deepEqual(payload.highlights, ["prva", "druga"]);
  });

  it("homeIntro / teamIntro / whyUs map to the shapes the service expects", () => {
    assert.deepEqual(
      buildSectionPayload("homeIntro", {
        title: "T",
        lead: "L",
        who: "W",
        massages: JSON.stringify([{ title: "M", text: "t", href: "/usluge/m" }]),
        packages: "P",
        closing: "C",
      }),
      { title: "T", lead: "L", who: "W", massages: [{ title: "M", text: "t", href: "/usluge/m" }], packages: "P", closing: "C" }
    );
    assert.deepEqual(
      buildSectionPayload("teamIntro", { eyebrow: "E", title: "T", lead: "L", highlights: JSON.stringify([{ icon: "bi-x", title: "a", text: "b" }]) }),
      { eyebrow: "E", title: "T", lead: "L", highlights: [{ icon: "bi-x", title: "a", text: "b" }] }
    );
    assert.deepEqual(buildSectionPayload("whyUs", { whyUs: JSON.stringify([{ icon: "", title: "a", text: "b" }]) }), [{ icon: "", title: "a", text: "b" }]);
  });

  it("garbage in the JSON field yields an empty list instead of throwing", () => {
    assert.deepEqual(buildSectionPayload("faq", { items: "{not json" }), { items: [] });
    assert.deepEqual(buildSectionPayload("faq", {}), { items: [] });
  });
});
