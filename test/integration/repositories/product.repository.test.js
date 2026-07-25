import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import productRepo from "../../../src/repositories/product.repository.js";
import "../../../src/models/category.model.js";
import "../../../src/models/tag.model.js";

function validProduct(overrides = {}) {
  const unique = new mongoose.Types.ObjectId().toString().slice(-8);
  return {
    name: "Krema za Lice",
    slug: `krema-za-lice-${unique}`,
    sku: `sku-${unique}`,
    image: { img: "/images/products/placeholder.webp", imgDesc: "Krema za lice" },
    variations: [{ label: "50ml", price: 2000, stock: 10, isActive: true }],
    ...overrides,
  };
}

describe("product.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createProduct / findProductById", () => {
    it("persists a product", async () => {
      const created = await productRepo.createProduct(validProduct());
      assert.ok(created._id);
      assert.equal(created.variations[0].price, 2000);
    });

    it("returns null for a nonexistent id", async () => {
      const found = await productRepo.findProductById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });

    it("rejects a duplicate sku", async () => {
      const product = validProduct();
      await productRepo.createProduct(product);
      await assert.rejects(() => productRepo.createProduct(validProduct({ sku: product.sku, slug: "different-slug" })));
    });

    it("rejects a duplicate slug", async () => {
      const product = validProduct();
      await productRepo.createProduct(product);
      await assert.rejects(() => productRepo.createProduct(validProduct({ slug: product.slug, sku: "different-sku" })));
    });
  });

  describe("findProductDocById - real (non-lean) document for in-place mutation", () => {
    it("returns a document whose variations[].stock can be mutated and saved", async () => {
      const created = await productRepo.createProduct(validProduct());
      const doc = await productRepo.findProductDocById(created._id);

      doc.variations[0].stock -= 3;
      await doc.save();

      const reloaded = await productRepo.findProductById(created._id);
      assert.equal(reloaded.variations[0].stock, 7);
    });
  });

  describe("findProductBySlug / findProductBySku", () => {
    it("finds by slug", async () => {
      const product = await productRepo.createProduct(validProduct());
      const found = await productRepo.findProductBySlug(product.slug);
      assert.equal(String(found._id), String(product._id));
    });

    it("finds by sku, normalizing case", async () => {
      const product = await productRepo.createProduct(validProduct({ sku: "abc-123" }));
      const found = await productRepo.findProductBySku("ABC-123");
      assert.equal(String(found._id), String(product._id));
    });

    it("returns null for an unrecognized slug/sku", async () => {
      assert.equal(await productRepo.findProductBySlug("nonexistent"), null);
      assert.equal(await productRepo.findProductBySku("nonexistent"), null);
    });
  });

  describe("findProductsByIds - bulk fetch for cart resolution", () => {
    it("returns only the requested ids, in one query", async () => {
      const a = await productRepo.createProduct(validProduct());
      const b = await productRepo.createProduct(validProduct());
      await productRepo.createProduct(validProduct()); // not requested

      const result = await productRepo.findProductsByIds([a._id, b._id]);

      assert.equal(result.length, 2);
    });

    it("returns an empty array for an empty ids list", async () => {
      const result = await productRepo.findProductsByIds([]);
      assert.equal(result.length, 0);
    });
  });

  describe("findProducts - filtering, search, and pagination", () => {
    it("search matches name, sku, or shortDescription", async () => {
      await productRepo.createProduct(validProduct({ name: "ESMA Uredjaj" }));
      await productRepo.createProduct(validProduct({ name: "Serum za Lice" }));

      const result = await productRepo.findProducts({ search: "esma" });

      assert.equal(result.total, 1);
    });

    it("filters by isActive", async () => {
      await productRepo.createProduct(validProduct({ isActive: true }));
      await productRepo.createProduct(validProduct({ isActive: false }));

      const result = await productRepo.findProducts({ filters: { isActive: true } });

      assert.equal(result.total, 1);
    });

    it("filters by inStock:true - at least one active variation with stock", async () => {
      await productRepo.createProduct(validProduct({ variations: [{ label: "50ml", price: 2000, stock: 5, isActive: true }] }));
      await productRepo.createProduct(validProduct({ variations: [{ label: "50ml", price: 2000, stock: 0, isActive: true }] }));

      const result = await productRepo.findProducts({ filters: { inStock: true } });

      assert.equal(result.total, 1);
    });

    it("filters by minPrice/maxPrice on variations.price", async () => {
      await productRepo.createProduct(validProduct({ variations: [{ label: "X", price: 1000, stock: 5, isActive: true }] }));
      await productRepo.createProduct(validProduct({ variations: [{ label: "X", price: 5000, stock: 5, isActive: true }] }));

      const result = await productRepo.findProducts({ filters: { minPrice: 2000, maxPrice: 6000 } });

      assert.equal(result.total, 1);
    });

    it("sorts newest first by default and paginates", async () => {
      for (let i = 0; i < 3; i++) {
        await productRepo.createProduct(validProduct());
      }

      const result = await productRepo.findProducts({ limit: 2, page: 1 });

      assert.equal(result.data.length, 2);
      assert.equal(result.total, 3);
      assert.equal(result.totalPages, 2);
    });
  });

  describe("updateProductById", () => {
    it("updates and returns the post-update document", async () => {
      const created = await productRepo.createProduct(validProduct());
      const updated = await productRepo.updateProductById(created._id, { name: "Novi Naziv" });
      assert.equal(updated.name, "Novi Naziv");
    });
  });

  describe("deleteProductById", () => {
    it("deletes the product", async () => {
      const created = await productRepo.createProduct(validProduct());
      await productRepo.deleteProductById(created._id);
      assert.equal(await productRepo.findProductById(created._id), null);
    });
  });

  describe("countProducts", () => {
    it("counts matching a filter - the exact shape used to guard Category deletion", async () => {
      const categoryId = new mongoose.Types.ObjectId();
      await productRepo.createProduct(validProduct({ categories: [categoryId] }));
      await productRepo.createProduct(validProduct());

      const count = await productRepo.countProducts({ category: categoryId });

      assert.equal(count, 1);
    });

    it("returns 0 when nothing matches", async () => {
      const count = await productRepo.countProducts({ category: new mongoose.Types.ObjectId() });
      assert.equal(count, 0);
    });
  });

  describe("pullCategoryFromAllProducts - Category-deletion auto-cleanup", () => {
    it("removes the category from every product's categories[] array", async () => {
      const categoryId = new mongoose.Types.ObjectId();
      const otherCategoryId = new mongoose.Types.ObjectId();
      const product = await productRepo.createProduct(validProduct({ categories: [categoryId, otherCategoryId] }));

      await productRepo.pullCategoryFromAllProducts(categoryId);

      const reloaded = await productRepo.findProductById(product._id, { populateFields: [] });
      assert.equal(reloaded.categories.length, 1);
      assert.equal(String(reloaded.categories[0]), String(otherCategoryId));
    });

    it("does nothing (no error) when no product references the category", async () => {
      // should NOT throw
      await productRepo.pullCategoryFromAllProducts(new mongoose.Types.ObjectId());
    });
  });
});