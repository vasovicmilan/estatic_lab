import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapProductsForAdminList,
  mapProductForAdminDetail,
  mapProductForEdit,
  mapProductForPublicCard,
  mapProductsForPublic,
  mapProductForPublicDetail,
} from "../../../src/mappers/product.mapper.js";
import { buildProduct, buildProductVariation, buildCategory, buildTag, id } from "../../helpers/factories.js";

describe("product.mapper", () => {
  describe("price range (via mapProductForPublicCard)", () => {
    it("shows a single price when every active variation costs the same", () => {
      const product = buildProduct({ variations: [buildProductVariation({ price: 1000 }), buildProductVariation({ price: 1000 })] });
      const mapped = mapProductForPublicCard(product);
      assert.equal(mapped.cena, "1000 RSD");
    });

    it("shows a range when active variations have different prices", () => {
      const product = buildProduct({ variations: [buildProductVariation({ price: 1000 }), buildProductVariation({ price: 2500 })] });
      const mapped = mapProductForPublicCard(product);
      assert.equal(mapped.cena, "1000 - 2500 RSD");
    });

    it("ignores inactive variations when computing the range", () => {
      const product = buildProduct({
        variations: [buildProductVariation({ price: 1000, isActive: true }), buildProductVariation({ price: 9999, isActive: false })],
      });
      const mapped = mapProductForPublicCard(product);
      assert.equal(mapped.cena, "1000 RSD");
    });

    it("returns null when there are no active variations at all", () => {
      const product = buildProduct({ variations: [buildProductVariation({ isActive: false })] });
      const mapped = mapProductForPublicCard(product);
      assert.equal(mapped.cena, null);
    });
  });

  describe("stock aggregation", () => {
    it("naStanju is true on the public card when total stock across variations is positive", () => {
      const product = buildProduct({ variations: [buildProductVariation({ stock: 0 }), buildProductVariation({ stock: 3 })] });
      assert.equal(mapProductForPublicCard(product).naStanju, true);
    });

    it("naStanju is false when every variation is out of stock", () => {
      const product = buildProduct({ variations: [buildProductVariation({ stock: 0 }), buildProductVariation({ stock: 0 })] });
      assert.equal(mapProductForPublicCard(product).naStanju, false);
    });

    it("sums stock across all variations for the admin detail's stanjeUkupno", () => {
      const product = buildProduct({ variations: [buildProductVariation({ stock: 5 }), buildProductVariation({ stock: 7 })] });
      assert.equal(mapProductForAdminDetail(product).stanjeUkupno, 12);
    });
  });

  describe("badge translation", () => {
    it("translates 'featured' to Serbian", () => {
      const product = buildProduct({ badge: "featured" });
      assert.equal(mapProductForPublicCard(product).oznaka, "Istaknuto");
    });

    it("translates 'sale' to Serbian", () => {
      const product = buildProduct({ badge: "sale" });
      assert.equal(mapProductForPublicCard(product).oznaka, "Na akciji");
    });

    it("'none' translates to null (no badge shown)", () => {
      const product = buildProduct({ badge: "none" });
      assert.equal(mapProductForPublicCard(product).oznaka, null);
    });

    it("admin detail exposes both the translated label and the raw value", () => {
      const product = buildProduct({ badge: "sale" });
      const mapped = mapProductForAdminDetail(product);
      assert.equal(mapped.oznaka, "Na akciji");
      assert.equal(mapped.oznakaRaw, "sale");
    });
  });

  describe("mapProductForPublicDetail - variation filtering", () => {
    it("only includes active variations on the public detail page", () => {
      const product = buildProduct({
        variations: [buildProductVariation({ label: "Aktivna", isActive: true }), buildProductVariation({ label: "Neaktivna", isActive: false })],
      });
      const mapped = mapProductForPublicDetail(product);
      assert.equal(mapped.varijante.length, 1);
      assert.equal(mapped.varijante[0].naziv, "Aktivna");
    });
  });

  describe("mapProductForAdminDetail - variation visibility", () => {
    it("includes inactive variations too, unlike the public detail page (admin needs to see and re-enable them)", () => {
      const product = buildProduct({
        variations: [buildProductVariation({ isActive: true }), buildProductVariation({ isActive: false })],
      });
      const mapped = mapProductForAdminDetail(product);
      assert.equal(mapped.varijante.length, 2);
    });
  });

  describe("category/tag name extraction", () => {
    it("extracts names from populated category/tag objects", () => {
      const category = buildCategory({ name: "Elektronika" });
      const tag = buildTag({ name: "Popularno" });
      const product = buildProduct({ categories: [category], tags: [tag] });
      const mapped = mapProductForAdminDetail(product);
      assert.deepEqual(mapped.kategorije, ["Elektronika"]);
      assert.deepEqual(mapped.tagovi, ["Popularno"]);
    });

    it("returns an empty array when categories/tags are unpopulated raw ObjectIds", () => {
      const product = buildProduct({ categories: [id()], tags: [id()] });
      const mapped = mapProductForAdminDetail(product);
      assert.deepEqual(mapped.kategorije, []);
      assert.deepEqual(mapped.tagovi, []);
    });
  });

  describe("mapProductsForAdminList", () => {
    it("filters out null/falsy entries instead of crashing on them", () => {
      const product = buildProduct();
      const result = mapProductsForAdminList([product, null, undefined]);
      assert.equal(result.length, 1);
    });

    it("maps isActive to a Da/Ne string for the list view", () => {
      const active = buildProduct({ isActive: true });
      const draft = buildProduct({ isActive: false });
      const result = mapProductsForAdminList([active, draft]);
      assert.equal(result[0].aktivan, "Da");
      assert.equal(result[1].aktivan, "Ne");
    });
  });

  describe("mapProductForEdit - raw (form-ready) shape", () => {
    it("flattens populated categories/tags/relatedProducts down to plain id strings", () => {
      const category = buildCategory();
      const tag = buildTag();
      const related = buildProduct();
      const product = buildProduct({ categories: [category], tags: [tag], relatedProducts: [related] });

      const mapped = mapProductForEdit(product);

      assert.equal(mapped.categories[0], category._id.toString());
      assert.equal(mapped.tags[0], tag._id.toString());
      assert.equal(mapped.relatedProducts[0], related._id.toString());
    });

    it("also handles already-unpopulated raw ObjectId refs the same way", () => {
      const categoryId = id();
      const product = buildProduct({ categories: [categoryId] });
      const mapped = mapProductForEdit(product);
      assert.equal(mapped.categories[0], categoryId.toString());
    });
  });

  describe("mapProductsForPublic", () => {
    it("maps a list of products to public cards, dropping any null entries", () => {
      const result = mapProductsForPublic([buildProduct(), null]);
      assert.equal(result.length, 1);
      assert.ok(result[0].naziv);
    });
  });

  describe("null safety", () => {
    it("every mapper function returns null for a null/undefined input instead of throwing", () => {
      assert.equal(mapProductForAdminDetail(null), null);
      assert.equal(mapProductForEdit(null), null);
      assert.equal(mapProductForPublicCard(null), null);
      assert.equal(mapProductForPublicDetail(null), null);
    });
  });
});