import { describe, it } from "node:test";
import assert from "node:assert/strict";
import productRepo from "../../../src/repositories/product.repository.js";
import * as productService from "../../../src/services/product.service.js";
import eventEmitter from "../../../src/events/event.emitter.js";
import { buildProduct, buildProductVariation, id } from "../../helpers/factories.js";

describe("product.service", () => {
  describe("createDraftProduct (phase 1)", () => {
    it("rejects a draft without a name", async () => {
      await assert.rejects(() => productService.createDraftProduct({ sku: "abc" }), (err) => err.statusCode === 400);
    });

    it("rejects a draft without a sku", async () => {
      await assert.rejects(() => productService.createDraftProduct({ name: "Test" }), (err) => err.statusCode === 400);
    });

    it("rejects a duplicate sku", async (t) => {
      t.mock.method(productRepo, "findProductBySku", async () => buildProduct());
      await assert.rejects(
        () => productService.createDraftProduct({ name: "Test", sku: "esma-001" }),
        (err) => err.statusCode === 409
      );
    });

    it("creates with no image, description, or categories required - only name+sku", async (t) => {
      t.mock.method(productRepo, "findProductBySku", async () => null);
      t.mock.method(productRepo, "findProductBySlug", async () => null);
      let created;
      t.mock.method(productRepo, "createProduct", async (payload) => {
        created = { ...buildProduct(), ...payload };
        return created;
      });

      await productService.createDraftProduct({ name: "Novi Proizvod", sku: "NP-001" });

      assert.equal(created.name, "Novi Proizvod");
      assert.equal(created.sku, "np-001", "sku should be lowercased");
      assert.equal(created.isActive, false, "a fresh draft is never published");
      assert.deepEqual(created.variations, []);
    });
  });

  describe("addDetailsAndMedia (phase 2)", () => {
    it("throws 404 for a nonexistent product", async (t) => {
      t.mock.method(productRepo, "findProductById", async () => null);
      await assert.rejects(() => productService.addDetailsAndMedia(id().toString(), {}), (err) => err.statusCode === 404);
    });

    it("rejects a variation missing a price", async (t) => {
      const existing = buildProduct({ variations: [] });
      t.mock.method(productRepo, "findProductById", async () => existing);
      await assert.rejects(
        () => productService.addDetailsAndMedia(existing._id.toString(), { variations: [{ label: "50ml", stock: 5 }] }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a variation missing stock", async (t) => {
      const existing = buildProduct({ variations: [] });
      t.mock.method(productRepo, "findProductById", async () => existing);
      await assert.rejects(
        () => productService.addDetailsAndMedia(existing._id.toString(), { variations: [{ label: "50ml", price: 1000 }] }),
        (err) => err.statusCode === 400
      );
    });

    it("keeps existing fields when the payload omits them (partial phase 2 submission)", async (t) => {
      const existing = buildProduct({ shortDescription: "Postojeći opis", categories: [id()] });
      t.mock.method(productRepo, "findProductById", async () => existing);
      let updatePayload;
      t.mock.method(productRepo, "updateProductById", async (pid, data) => {
        updatePayload = data;
        return { ...existing, ...data };
      });

      await productService.addDetailsAndMedia(existing._id.toString(), { variations: [buildProductVariation()] });

      assert.equal(updatePayload.shortDescription, "Postojeći opis");
      assert.deepEqual(updatePayload.categories, existing.categories);
    });
  });

  describe("addSeoAndPublish (phase 3) - publish invariants", () => {
    it("refuses to publish without an image", async (t) => {
      const existing = buildProduct({ image: null, variations: [buildProductVariation()] });
      t.mock.method(productRepo, "findProductById", async () => existing);
      await assert.rejects(
        () => productService.addSeoAndPublish(existing._id.toString(), { isActive: true }),
        (err) => err.statusCode === 400
      );
    });

    it("refuses to publish without at least one variation", async (t) => {
      const existing = buildProduct({ variations: [] });
      t.mock.method(productRepo, "findProductById", async () => existing);
      await assert.rejects(
        () => productService.addSeoAndPublish(existing._id.toString(), { isActive: true }),
        (err) => err.statusCode === 400
      );
    });

    it("allows saving as a draft (isActive: false) even without an image or variations", async (t) => {
      const existing = buildProduct({ image: null, variations: [] });
      t.mock.method(productRepo, "findProductById", async () => existing);
      t.mock.method(productRepo, "updateProductById", async (pid, data) => ({ ...existing, ...data }));

      // should NOT throw
      await productService.addSeoAndPublish(existing._id.toString(), { isActive: false });
    });

    it("publishes successfully when both an image and a variation exist", async (t) => {
      const existing = buildProduct({ image: { img: "/images/products/x.webp" }, variations: [buildProductVariation()] });
      t.mock.method(productRepo, "findProductById", async () => existing);
      let updatePayload;
      t.mock.method(productRepo, "updateProductById", async (pid, data) => {
        updatePayload = data;
        return { ...existing, ...data };
      });

      await productService.addSeoAndPublish(existing._id.toString(), { isActive: true, badge: "featured" });

      assert.equal(updatePayload.isActive, true);
      assert.equal(updatePayload.badge, "featured");
    });
  });

  describe("getVariationRaw", () => {
    it("throws 404 if the product itself isn't active", async (t) => {
      const product = buildProduct({ isActive: false });
      t.mock.method(productRepo, "findProductById", async () => product);
      await assert.rejects(
        () => productService.getVariationRaw(product._id.toString(), product.variations[0]._id.toString()),
        (err) => err.statusCode === 404
      );
    });

    it("throws 404 if the specific variation is inactive, even though the product is active", async (t) => {
      const variation = buildProductVariation({ isActive: false });
      const product = buildProduct({ variations: [variation] });
      t.mock.method(productRepo, "findProductById", async () => product);
      await assert.rejects(
        () => productService.getVariationRaw(product._id.toString(), variation._id.toString()),
        (err) => err.statusCode === 404
      );
    });

    it("returns the product and variation for a valid, active pair", async (t) => {
      const variation = buildProductVariation();
      const product = buildProduct({ variations: [variation] });
      t.mock.method(productRepo, "findProductById", async () => product);

      const result = await productService.getVariationRaw(product._id.toString(), variation._id.toString());

      assert.equal(String(result.product._id), String(product._id));
      assert.equal(String(result.variation._id), String(variation._id));
    });
  });

  describe("decreaseVariationStock", () => {
    // findProductDocById returns a real Mongoose document elsewhere (with
    // variations.id() and .save()), so this fake mimics just enough of that shape
    function fakeProductDoc(variation) {
      return {
        _id: id(),
        name: "ESMA Uređaj",
        sku: "esma-001",
        variations: { id: (vid) => (String(vid) === String(variation._id) ? variation : null) },
        save: async () => {},
      };
    }

    it("rejects when requested quantity exceeds available stock", async (t) => {
      const variation = buildProductVariation({ stock: 2 });
      t.mock.method(productRepo, "findProductDocById", async () => fakeProductDoc(variation));

      await assert.rejects(
        () => productService.decreaseVariationStock(id().toString(), variation._id.toString(), 5),
        (err) => err.statusCode === 400
      );
    });

    it("throws 400 for a variation id that doesn't exist on the product", async (t) => {
      const variation = buildProductVariation();
      t.mock.method(productRepo, "findProductDocById", async () => fakeProductDoc(variation));

      await assert.rejects(
        () => productService.decreaseVariationStock(id().toString(), id().toString(), 1),
        (err) => err.statusCode === 400
      );
    });

    it("decrements stock and does NOT emit any stock event while comfortably above the threshold", async (t) => {
      const variation = buildProductVariation({ stock: 20, lowStockThreshold: 5 });
      t.mock.method(productRepo, "findProductDocById", async () => fakeProductDoc(variation));

      let emitted = false;
      const handler = () => { emitted = true; };
      eventEmitter.on("product:low_stock", handler);
      eventEmitter.on("product:out_of_stock", handler);

      try {
        await productService.decreaseVariationStock(id().toString(), variation._id.toString(), 1);
        assert.equal(variation.stock, 19);
        assert.equal(emitted, false);
      } finally {
        eventEmitter.off("product:low_stock", handler);
        eventEmitter.off("product:out_of_stock", handler);
      }
    });

    it("emits product:low_stock once remaining stock crosses the threshold", async (t) => {
      const variation = buildProductVariation({ stock: 6, lowStockThreshold: 5 });
      t.mock.method(productRepo, "findProductDocById", async () => fakeProductDoc(variation));

      let received;
      const handler = (payload) => { received = payload; };
      eventEmitter.on("product:low_stock", handler);

      try {
        await productService.decreaseVariationStock(id().toString(), variation._id.toString(), 1);
        assert.ok(received, "product:low_stock should have fired");
        assert.equal(received.stock, 5);
      } finally {
        eventEmitter.off("product:low_stock", handler);
      }
    });

    it("emits product:out_of_stock (not low_stock) once stock hits zero", async (t) => {
      const variation = buildProductVariation({ stock: 1, lowStockThreshold: 5 });
      t.mock.method(productRepo, "findProductDocById", async () => fakeProductDoc(variation));

      let lowStockFired = false;
      let outOfStockFired = false;
      const lowHandler = () => { lowStockFired = true; };
      const outHandler = () => { outOfStockFired = true; };
      eventEmitter.on("product:low_stock", lowHandler);
      eventEmitter.on("product:out_of_stock", outHandler);

      try {
        await productService.decreaseVariationStock(id().toString(), variation._id.toString(), 1);
        assert.equal(outOfStockFired, true);
        assert.equal(lowStockFired, false, "out_of_stock should fire instead of low_stock, not alongside it");
      } finally {
        eventEmitter.off("product:low_stock", lowHandler);
        eventEmitter.off("product:out_of_stock", outHandler);
      }
    });
  });

  describe("restoreVariationStock", () => {
    it("returns null gracefully if the product no longer exists", async (t) => {
      t.mock.method(productRepo, "findProductDocById", async () => null);
      const result = await productService.restoreVariationStock(id().toString(), id().toString(), 1);
      assert.equal(result, null);
    });

    it("returns the product unchanged if the specific variation no longer exists", async (t) => {
      const fakeDoc = { _id: id(), variations: { id: () => null }, save: async () => {} };
      t.mock.method(productRepo, "findProductDocById", async () => fakeDoc);
      const result = await productService.restoreVariationStock(id().toString(), id().toString(), 1);
      assert.equal(result, fakeDoc);
    });

    it("adds the quantity back onto the variation's stock", async (t) => {
      const variation = buildProductVariation({ stock: 3 });
      const fakeDoc = { _id: id(), variations: { id: () => variation }, save: async () => {} };
      t.mock.method(productRepo, "findProductDocById", async () => fakeDoc);

      await productService.restoreVariationStock(id().toString(), variation._id.toString(), 4);

      assert.equal(variation.stock, 7);
    });
  });
});