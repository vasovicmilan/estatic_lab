import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatImage } from "../../../src/utils/image-format.util.js";

describe("image-format.util - formatImage", () => {
  it("maps img/imgDesc to url/alt", () => {
    assert.deepEqual(formatImage({ img: "/x.webp", imgDesc: "Opis" }), { url: "/x.webp", alt: "Opis" });
  });

  it("returns null for a missing image, without throwing", () => {
    assert.equal(formatImage(null), null);
    assert.equal(formatImage(undefined), null);
  });

  it("falls back to null fields when img/imgDesc are themselves missing", () => {
    assert.deepEqual(formatImage({}), { url: null, alt: null });
  });
});
