import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapUserForAdminShort,
  mapUserForAdminDetail,
  mapUserForSelect,
  mapUserAddresses,
  mapUserCart,
  mapUser,
} from "../../../src/mappers/user.mapper.js";
import { buildAddressRecord } from "../../../src/utils/address.util.js";
import { buildUser, buildRole, buildProduct, buildProductVariation, id } from "../../helpers/factories.js";

describe("user.mapper", () => {
  describe("role name translation", () => {
    it("translates admin/employee/user role names to Serbian", () => {
      assert.equal(mapUserForAdminShort(buildUser({ role: buildRole({ name: "admin" }) })).uloga, "Administrator");
      assert.equal(mapUserForAdminShort(buildUser({ role: buildRole({ name: "employee" }) })).uloga, "Zaposleni");
      assert.equal(mapUserForAdminShort(buildUser({ role: buildRole({ name: "user" }) })).uloga, "Korisnik");
    });

    it("falls back to the raw role name for a custom role (roles are slug-based, not a fixed enum)", () => {
      const mapped = mapUserForAdminShort(buildUser({ role: buildRole({ name: "supervizor" }) }));
      assert.equal(mapped.uloga, "supervizor");
    });

    it("shows 'Nepoznato' when the role isn't populated", () => {
      const mapped = mapUserForAdminShort(buildUser({ role: id() }));
      assert.equal(mapped.uloga, "Nepoznato");
    });
  });

  describe("status/provider translation", () => {
    it("translates every account status", () => {
      const statuses = { guest: "Gost", pending: "Na čekanju potvrde", active: "Aktivan", inactive: "Neaktivan", suspended: "Suspendovan" };
      for (const [raw, translated] of Object.entries(statuses)) {
        assert.equal(mapUserForAdminShort(buildUser({ status: raw })).status, translated);
      }
    });

    it("translates the login provider", () => {
      assert.equal(mapUserForAdminDetail(buildUser({ provider: "google" })).nacinPrijave, "Google nalog");
      assert.equal(mapUserForAdminDetail(buildUser({ provider: "local" })).nacinPrijave, "Email i lozinka");
    });
  });

  describe("mapUserForAdminDetail - role id for pre-selecting a dropdown", () => {
    it("resolves the role id whether populated or raw", () => {
      const role = buildRole();
      const withPopulated = mapUserForAdminDetail(buildUser({ role }));
      assert.equal(withPopulated.roleId, role._id.toString());

      const rawRoleId = id();
      const withRaw = mapUserForAdminDetail(buildUser({ role: rawRoleId }));
      assert.equal(withRaw.roleId, rawRoleId.toString());
    });
  });

  describe("mapUserForSelect - lightweight ref for other mappers", () => {
    it("returns a minimal shape for a populated user", () => {
      const user = buildUser({ firstName: "Ana", lastName: "Anic" });
      const mapped = mapUserForSelect(user);
      assert.equal(mapped.imePrezime, "Ana Anic");
    });

    it("handles a bare string id (not even an ObjectId) gracefully", () => {
      const mapped = mapUserForSelect("64b000000000000000000000");
      assert.deepEqual(mapped, { id: "64b000000000000000000000" });
    });

    it("returns null for a null user", () => {
      assert.equal(mapUserForSelect(null), null);
    });
  });

  describe("mapUserAddresses - real encryption round-trip", () => {
    it("decrypts every saved address back to plain values", () => {
      const encrypted = buildAddressRecord({ city: "Novi Sad", postalCode: "21000", street: "Bulevar", number: "10", label: "Kuca", isDefault: true });
      const user = buildUser({ addresses: [encrypted] });
      const mapped = mapUserAddresses(user);
      assert.equal(mapped[0].grad, "Novi Sad");
      assert.equal(mapped[0].naziv, "Kuca");
      assert.equal(mapped[0].podrazumevana, true);
    });

    it("returns an empty array when there are no saved addresses", () => {
      assert.deepEqual(mapUserAddresses(buildUser({ addresses: [] })), []);
    });
  });

  describe("mapUserCart - stock overshoot and stale-line handling", () => {
    function cartFixture({ stock = 10, quantity = 1 } = {}) {
      const variation = buildProductVariation({ stock, price: 2000 });
      const product = buildProduct({ variations: [variation] });
      return buildUser({ cart: [{ _id: id(), product, variant: variation._id, quantity }] });
    }

    it("computes ukupno as price * quantity", () => {
      const user = cartFixture({ quantity: 3 });
      const mapped = mapUserCart(user);
      assert.equal(mapped.stavke[0].ukupno, 6000);
    });

    it("flags prekoracenje (overshoot) when quantity exceeds available stock", () => {
      const user = cartFixture({ stock: 2, quantity: 5 });
      const mapped = mapUserCart(user);
      assert.equal(mapped.stavke[0].prekoracenje, true);
    });

    it("does not flag prekoracenje when quantity is within stock", () => {
      const user = cartFixture({ stock: 10, quantity: 2 });
      assert.equal(mapUserCart(user).stavke[0].prekoracenje, false);
    });

    it("naStanju is false when stock is exactly 0", () => {
      const user = cartFixture({ stock: 0, quantity: 1 });
      assert.equal(mapUserCart(user).stavke[0].naStanju, false);
    });

    it("silently drops a cart line whose product is unpopulated (e.g. the product was since deleted)", () => {
      const user = buildUser({ cart: [{ _id: id(), product: id(), variant: id(), quantity: 1 }] });
      const mapped = mapUserCart(user);
      assert.equal(mapped.stavke.length, 0);
    });

    it("silently drops a cart line whose variant no longer exists on the product", () => {
      const product = buildProduct({ variations: [buildProductVariation()] });
      const user = buildUser({ cart: [{ _id: id(), product, variant: id(), quantity: 1 }] });
      const mapped = mapUserCart(user);
      assert.equal(mapped.stavke.length, 0);
    });

    it("sums brojStavki and ukupnaCena across multiple valid lines", () => {
      const variationA = buildProductVariation({ price: 1000 });
      const productA = buildProduct({ variations: [variationA] });
      const variationB = buildProductVariation({ price: 500 });
      const productB = buildProduct({ variations: [variationB] });
      const user = buildUser({
        cart: [
          { _id: id(), product: productA, variant: variationA._id, quantity: 2 },
          { _id: id(), product: productB, variant: variationB._id, quantity: 3 },
        ],
      });
      const mapped = mapUserCart(user);
      assert.equal(mapped.brojStavki, 5);
      assert.equal(mapped.ukupnaCena, 3500);
    });

    it("returns a valid empty-cart shape (not null/undefined) when the cart is empty", () => {
      const mapped = mapUserCart(buildUser({ cart: [] }));
      assert.deepEqual(mapped, { stavke: [], brojStavki: 0, ukupnaCena: 0 });
    });
  });

  describe("mapUser dispatcher", () => {
    it("returns the profile shape when isOwnProfile is true, regardless of role", () => {
      const mapped = mapUser(buildUser(), "admin", "short", true);
      assert.ok("clanOd" in mapped, "the profile shape has clanOd, which no other shape does");
    });

    it("returns the admin short/detail shapes for role=admin", () => {
      const user = buildUser();
      assert.ok(!("firstName" in mapUser(user, "admin", "short")));
      assert.ok("firstName" in mapUser(user, "admin", "detail"));
    });

    it("returns the employee shapes for role=employee", () => {
      const mapped = mapUser(buildUser(), "employee", "short");
      assert.ok(!("uloga" in mapped), "the employee-facing shape doesn't need the customer's role label");
    });

    it("returns a minimal public shape for any other role", () => {
      const mapped = mapUser(buildUser(), "guest-viewer", "short");
      assert.deepEqual(Object.keys(mapped).sort(), ["avatar", "email", "id", "imePrezime"]);
    });

    it("returns null for a null user", () => {
      assert.equal(mapUser(null, "admin", "detail"), null);
    });
  });
});