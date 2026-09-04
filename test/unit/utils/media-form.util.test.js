import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGalleryPayload, buildVideosPayload } from "../../../src/utils/media-form.util.js";

describe("media-form.util - buildGalleryPayload", () => {
  it("pairs each newly uploaded file with its own description by index (admin-gallery-uploader.js's per-row inputs)", () => {
    const req = {
      body: { newGalleryDesc: ["Prva slika", "Druga slika", "Treca slika"] },
      uploadedFiles: { gallery: [{ img: "/images/products/a.webp" }, { img: "/images/products/b.webp" }, { img: "/images/products/c.webp" }] },
    };

    const gallery = buildGalleryPayload(req);

    assert.deepEqual(gallery, [
      { img: "/images/products/a.webp", imgDesc: "Prva slika" },
      { img: "/images/products/b.webp", imgDesc: "Druga slika" },
      { img: "/images/products/c.webp", imgDesc: "Treca slika" },
    ]);
  });

  it("handles exactly one new image, where the bracketed field arrives as a plain string rather than a 1-item array", () => {
    const req = {
      body: { newGalleryDesc: "Jedina nova slika" },
      uploadedFiles: { gallery: [{ img: "/images/products/a.webp" }] },
    };

    const gallery = buildGalleryPayload(req);

    assert.deepEqual(gallery, [{ img: "/images/products/a.webp", imgDesc: "Jedina nova slika" }]);
  });

  it("defaults a missing description to an empty string rather than throwing or misaligning the rest", () => {
    const req = {
      body: { newGalleryDesc: ["Prva slika", ""] },
      uploadedFiles: { gallery: [{ img: "/images/products/a.webp" }, { img: "/images/products/b.webp" }] },
    };

    const gallery = buildGalleryPayload(req);

    assert.equal(gallery[0].imgDesc, "Prva slika");
    assert.equal(gallery[1].imgDesc, "");
  });

  it("keeps existing images (minus any checked for removal) and appends new ones after them, in that order", () => {
    const req = {
      body: {
        existingGalleryImg: ["/images/products/old1.webp", "/images/products/old2.webp"],
        existingGalleryDesc: ["Stara 1", "Stara 2"],
        removeGallery: ["0"],
        newGalleryDesc: ["Nova slika"],
      },
      uploadedFiles: { gallery: [{ img: "/images/products/new1.webp" }] },
    };

    const gallery = buildGalleryPayload(req);

    assert.deepEqual(gallery, [
      { img: "/images/products/old2.webp", imgDesc: "Stara 2" },
      { img: "/images/products/new1.webp", imgDesc: "Nova slika" },
    ]);
  });

  it("returns an empty array when nothing existing or new is present", () => {
    assert.deepEqual(buildGalleryPayload({ body: {} }), []);
  });
});

describe("media-form.util - buildVideosPayload", () => {
  it("normalizes the isExternal flag from form string values to real booleans", () => {
    const req = { body: { videos: [{ url: "https://youtu.be/x", isExternal: "true" }] } };
    assert.equal(buildVideosPayload(req)[0].isExternal, true);
  });

  it("marks newly uploaded (self-hosted) videos as not external", () => {
    const req = { body: {}, uploadedFiles: { video: [{ url: "/videos/x.mp4", thumbnail: "/videos/thumbnails/x.jpg" }] } };
    const videos = buildVideosPayload(req);
    assert.equal(videos[0].isExternal, false);
    assert.equal(videos[0].url, "/videos/x.mp4");
  });

  it("drops any submitted video entries missing a url", () => {
    const req = { body: { videos: [{ title: "Nema url" }, { url: "https://youtu.be/ok" }] } };
    assert.equal(buildVideosPayload(req).length, 1);
  });
});