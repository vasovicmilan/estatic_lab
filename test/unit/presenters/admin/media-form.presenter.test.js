import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareMediaFormData } from "../../../../src/presenters/admin/media-form.presenter.js";

describe("prepareMediaFormData", () => {
  it("defaults gallery/videos to empty arrays and image to null when the entity has none", () => {
    const view = prepareMediaFormData(
      { id: "s1", name: "Masaza" },
      { entityLabel: "Usluga", backUrl: "/admin/usluge/detalji/s1", submitUrl: "/admin/usluge/s1/galerija", listUrl: "/admin/usluge", listLabel: "Usluge" }
    );

    assert.equal(view.image, null);
    assert.deepEqual(view.gallery, []);
    assert.deepEqual(view.videos, []);
  });

  it("passes through the entity's actual image/gallery/videos when present", () => {
    const entity = { id: "s1", name: "Masaza", image: { url: "/x.webp" }, gallery: [{ url: "/y.webp" }], videos: [{ url: "/z.mp4" }] };
    const view = prepareMediaFormData(entity, { entityLabel: "Usluga", backUrl: "/x", submitUrl: "/y", listUrl: "/admin/usluge", listLabel: "Usluge" });

    assert.deepEqual(view.image, { url: "/x.webp" });
    assert.equal(view.gallery.length, 1);
    assert.equal(view.videos.length, 1);
  });

  it("builds a 3-level breadcrumb trail ending in 'Galerija i video' when a listUrl is given", () => {
    const view = prepareMediaFormData(
      { id: "s1", name: "Masaza" },
      { entityLabel: "Usluga", backUrl: "/admin/usluge/detalji/s1", submitUrl: "/x", listUrl: "/admin/usluge", listLabel: "Usluge" }
    );

    assert.equal(view.breadcrumbs.length, 3);
    assert.equal(view.breadcrumbs[0].label, "Usluge");
    assert.equal(view.breadcrumbs.at(-1).label, "Galerija i video");
  });

  it("returns an empty breadcrumb trail when no listUrl is given", () => {
    const view = prepareMediaFormData({ id: "s1", name: "Masaza" }, { entityLabel: "Usluga", backUrl: "/x", submitUrl: "/y" });
    assert.deepEqual(view.breadcrumbs, []);
  });
});