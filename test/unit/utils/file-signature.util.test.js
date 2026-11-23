import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectMaterialMimeType } from "../../../src/utils/file-signature.util.js";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n", "ascii");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const html = Buffer.from("<html><script>alert(1)</script></html>");

describe("file-signature.util detectMaterialMimeType", () => {
  it("accepts a real PDF, PNG, JPEG, WEBP and Office (zip) file under the matching extension", () => {
    assert.equal(detectMaterialMimeType(pdf, ".pdf"), "application/pdf");
    assert.equal(detectMaterialMimeType(png, ".png"), "image/png");
    assert.equal(detectMaterialMimeType(jpeg, ".jpg"), "image/jpeg");
    assert.equal(detectMaterialMimeType(jpeg, ".jpeg"), "image/jpeg");
    assert.equal(detectMaterialMimeType(webp, ".webp"), "image/webp");
    assert.match(detectMaterialMimeType(zip, ".docx"), /wordprocessingml/);
    assert.match(detectMaterialMimeType(zip, ".xlsx"), /spreadsheetml/);
    assert.match(detectMaterialMimeType(zip, ".pptx"), /presentationml/);
  });

  it("REGRESSION: rejects an HTML/script payload renamed to .pdf (the client's mimetype proves nothing)", () => {
    assert.equal(detectMaterialMimeType(html, ".pdf"), null);
    assert.equal(detectMaterialMimeType(html, ".png"), null);
    assert.equal(detectMaterialMimeType(html, ".docx"), null);
  });

  it("rejects a file whose bytes belong to a different type than its extension says", () => {
    assert.equal(detectMaterialMimeType(png, ".pdf"), null);
    assert.equal(detectMaterialMimeType(pdf, ".jpg"), null);
  });

  it("rejects unknown extensions and empty / non-buffer input", () => {
    assert.equal(detectMaterialMimeType(pdf, ".exe"), null);
    assert.equal(detectMaterialMimeType(pdf, ".html"), null);
    assert.equal(detectMaterialMimeType(Buffer.alloc(0), ".pdf"), null);
    assert.equal(detectMaterialMimeType("%PDF-", ".pdf"), null);
  });
});
