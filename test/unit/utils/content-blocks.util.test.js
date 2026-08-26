import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderContentBlocks, contentBlocksToPlainText, markdownStringToBlocks } from "../../../src/utils/content-blocks.util.js";

describe("content-blocks.util", () => {
  describe("renderContentBlocks", () => {
    it("sorts blocks by their order field regardless of input order", () => {
      const blocks = renderContentBlocks([
        { type: "paragraph", text: "second", order: 2 },
        { type: "paragraph", text: "first", order: 1 },
      ]);
      assert.deepEqual(
        blocks.map((b) => b.tekst),
        ["first", "second"]
      );
    });

    it("maps a heading block's level to nivo and text to tekst", () => {
      const [block] = renderContentBlocks([{ type: "heading", level: 2, text: "Naslov", order: 0 }]);
      assert.equal(block.tip, "heading");
      assert.equal(block.nivo, 2);
      assert.equal(block.tekst, "Naslov");
    });

    it("maps an image block's nested img/imgDesc to url/alt", () => {
      const [block] = renderContentBlocks([{ type: "image", image: { img: "/x.webp", imgDesc: "Opis" }, order: 0 }]);
      assert.deepEqual(block.slika, { url: "/x.webp", alt: "Opis" });
    });

    it("returns an empty array for an empty/missing input, without throwing", () => {
      assert.deepEqual(renderContentBlocks([]), []);
      assert.deepEqual(renderContentBlocks(), []);
    });
  });

  describe("contentBlocksToPlainText", () => {
    it("joins prose-bearing blocks (paragraph/heading/quote/callout) into one string", () => {
      const text = contentBlocksToPlainText([
        { type: "heading", text: "Naslov", order: 0 },
        { type: "paragraph", text: "Pasus jedan.", order: 1 },
        { type: "list", items: ["a", "b"], order: 2 }, // no `text` field - skipped
      ]);
      assert.equal(text, "Naslov Pasus jedan.");
    });

    it("returns an empty string when there are no prose blocks at all", () => {
      assert.equal(contentBlocksToPlainText([{ type: "image", order: 0 }]), "");
    });
  });

  describe("markdownStringToBlocks", () => {
    it("returns an empty array for empty/missing input", () => {
      assert.deepEqual(markdownStringToBlocks(""), []);
      assert.deepEqual(markdownStringToBlocks(null), []);
    });

    it("converts a plain paragraph with no special formatting as-is", () => {
      const blocks = markdownStringToBlocks("Ovo je običan pasus bez ičega posebnog.");
      assert.deepEqual(blocks, [{ type: "paragraph", text: "Ovo je običan pasus bez ičega posebnog.", order: 0 }]);
    });

    it("splits multiple paragraphs on blank lines", () => {
      const blocks = markdownStringToBlocks("Prvi pasus.\n\nDrugi pasus.");
      assert.equal(blocks.length, 2);
      assert.equal(blocks[0].text, "Prvi pasus.");
      assert.equal(blocks[1].text, "Drugi pasus.");
    });

    it("REGRESSION: converts '**Heading:** inline text' into a heading block plus a separate paragraph block", () => {
      const blocks = markdownStringToBlocks("**Princip rada:** Uveličano snimanje omogućava uvid u stanje.");
      assert.equal(blocks.length, 2);
      assert.deepEqual(blocks[0], { type: "heading", level: 3, text: "Princip rada", order: 0 });
      assert.deepEqual(blocks[1], { type: "paragraph", text: "Uveličano snimanje omogućava uvid u stanje.", order: 1 });
    });

    it("REGRESSION: converts '**Heading:**' followed by '- bullet' lines into a heading block plus a list block", () => {
      const blocks = markdownStringToBlocks("**Namena:**\n- Prva stavka\n- Druga stavka");
      assert.equal(blocks.length, 2);
      assert.deepEqual(blocks[0], { type: "heading", level: 3, text: "Namena", order: 0 });
      assert.deepEqual(blocks[1], { type: "list", items: ["Prva stavka", "Druga stavka"], ordered: false, order: 1 });
    });

    it("REGRESSION: converts a whole-paragraph '*italic note*' into a callout block, stripping the asterisks", () => {
      const blocks = markdownStringToBlocks("*Napomena: proverite tačne vrednosti pre kupovine.*");
      assert.deepEqual(blocks, [{ type: "callout", variant: "info", text: "Napomena: proverite tačne vrednosti pre kupovine.", order: 0 }]);
    });

    it("handles a heading whose own label contains a colon (parentheses with an internal colon)", () => {
      const blocks = markdownStringToBlocks("**Nabavni podaci (cenovnik, avgust 2026):**\n- Šifra: FM-1\n- Garancija: 12 meseci");
      assert.equal(blocks[0].text, "Nabavni podaci (cenovnik, avgust 2026)");
      assert.deepEqual(blocks[1].items, ["Šifra: FM-1", "Garancija: 12 meseci"]);
    });

    it("strips stray ** markers from an ordinary paragraph that isn't a recognized heading line", () => {
      const blocks = markdownStringToBlocks("Ovo ima **naglašenu** reč usred pasusa.");
      assert.equal(blocks[0].text, "Ovo ima naglašenu reč usred pasusa.");
    });

    it("handles a bullet list with no preceding heading line", () => {
      const blocks = markdownStringToBlocks("- Samostalna stavka jedan\n- Samostalna stavka dva");
      assert.deepEqual(blocks, [{ type: "list", items: ["Samostalna stavka jedan", "Samostalna stavka dva"], ordered: false, order: 0 }]);
    });

    it("converts the full real-world Scalp Analysis Machine seed text end to end, matching every block in order", () => {
      const text = [
        "Scalp Analysis Machine je specijalizovan dijagnostički uređaj.",
        "",
        "**Princip rada:** Uveličano snimanje omogućava detaljan uvid.",
        "",
        "**Namena:**\n- Trihološke konsultacije\n- Dermatološke konsultacije",
        "",
        "*Napomena: potvrdite tačne vrednosti pre kupovine.*",
        "",
        "**Nabavni podaci (cenovnik, avgust 2026):**\n- Šifra: FM-SKN-SCALP\n- Garancija: 12-24 meseca",
      ].join("\n");

      const blocks = markdownStringToBlocks(text);

      assert.deepEqual(
        blocks.map((b) => b.type),
        ["paragraph", "heading", "paragraph", "heading", "list", "callout", "heading", "list"]
      );
      // order is strictly increasing and gapless, matching how the admin
      // content-blocks widget expects to number newly-added blocks
      assert.deepEqual(
        blocks.map((b) => b.order),
        [0, 1, 2, 3, 4, 5, 6, 7]
      );
    });
  });
});
