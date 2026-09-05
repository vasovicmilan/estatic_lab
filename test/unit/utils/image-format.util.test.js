import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatImage, getImageVariantUrl, getResponsiveImageUrls, getVerifiedResponsiveImageUrls } from "../../../src/utils/image-format.util.js";
import fileCleanupUtil from "../../../src/utils/file-cleanup.util.js";

describe("image-format.util - formatImage", () => {
  it("maps img/imgDesc to url/alt, plus the derived thumb/medium/original variants", () => {
    assert.deepEqual(formatImage({ img: "/images/services/x-778-medium.webp", imgDesc: "Opis" }), {
      url: "/images/services/x-778-medium.webp",
      alt: "Opis",
      variants: {
        thumb: "/images/services/x-778-thumb.webp",
        medium: "/images/services/x-778-medium.webp",
        original: "/images/services/x-778-original.webp",
      },
    });
  });

  it("returns null for a missing image, without throwing", () => {
    assert.equal(formatImage(null), null);
    assert.equal(formatImage(undefined), null);
  });

  it("falls back to null fields (and all-null variants) when img/imgDesc are themselves missing", () => {
    assert.deepEqual(formatImage({}), { url: null, alt: null, variants: { thumb: null, medium: null, original: null } });
  });
});

describe("image-format.util - getVerifiedResponsiveImageUrls", () => {
  it("keeps only the variants that actually exist on disk", (t) => {
    t.mock.method(fileCleanupUtil, "imageFileExists", (url) => url.endsWith("-medium.webp"));

    assert.deepEqual(getVerifiedResponsiveImageUrls("/images/site/hero-medium.webp"), {
      thumb: null,
      medium: "/images/site/hero-medium.webp",
      original: null,
    });
  });

  it("keeps all three when all exist on disk", (t) => {
    t.mock.method(fileCleanupUtil, "imageFileExists", () => true);

    assert.deepEqual(getVerifiedResponsiveImageUrls("/images/site/hero-9-medium.webp"), {
      thumb: "/images/site/hero-9-thumb.webp",
      medium: "/images/site/hero-9-medium.webp",
      original: "/images/site/hero-9-original.webp",
    });
  });
});

describe("image-format.util - getImageVariantUrl", () => {
  it("swaps the -medium suffix for -thumb", () => {
    assert.equal(
      getImageVariantUrl("/images/site/hero-1784-medium.webp", "thumb"),
      "/images/site/hero-1784-thumb.webp"
    );
  });

  it("swaps the -thumb suffix for -original", () => {
    assert.equal(
      getImageVariantUrl("/images/services/masaza-99-thumb.webp", "original"),
      "/images/services/masaza-99-original.webp"
    );
  });

  it("returns null for an unknown variant name", () => {
    assert.equal(getImageVariantUrl("/images/site/hero-1-medium.webp", "large"), null);
  });

  it("returns null for a missing url", () => {
    assert.equal(getImageVariantUrl(null, "thumb"), null);
    assert.equal(getImageVariantUrl(undefined, "medium"), null);
  });

  it("returns null when the url doesn't follow the thumb/medium/original convention", () => {
    assert.equal(getImageVariantUrl("/images/site/default-og.webp", "thumb"), null);
    assert.equal(getImageVariantUrl("/images/site/hero-medium.webp", "thumb"), "/images/site/hero-thumb.webp");
  });
});

describe("image-format.util - getResponsiveImageUrls", () => {
  it("derives all three variants from any single one", () => {
    assert.deepEqual(getResponsiveImageUrls("/images/site/hero-1784-medium.webp"), {
      thumb: "/images/site/hero-1784-thumb.webp",
      medium: "/images/site/hero-1784-medium.webp",
      original: "/images/site/hero-1784-original.webp",
    });
  });

  it("returns all-null variants for a non-conforming url", () => {
    assert.deepEqual(getResponsiveImageUrls("/images/site/default-og.webp"), {
      thumb: null,
      medium: null,
      original: null,
    });
  });
});
