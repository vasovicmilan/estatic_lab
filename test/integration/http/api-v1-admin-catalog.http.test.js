import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { registerAndLogin } from "../../helpers/session.js";

async function loginAsAdmin(app, email) {
  const agent = request.agent(app);
  await registerAndLogin(agent, { email, roleName: "admin" });
  const res = await request(app).post("/api/v1/auth/prijava").send({ email, password: "lozinka123" });
  return res.body.data.token;
}

describe("API v1 admin catalog routes (HTTP)", () => {
  let app;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await closeTestApp();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  describe("services", () => {
    it("creates a draft service with no packages/image, stays inactive", async () => {
      const token = await loginAsAdmin(app, "admin1@example.com");
      // addExtrasAndPublish (service.service.js) defaults isActive to true when
      // omitted entirely (`data.isActive ?? true`) - a real draft needs it sent
      // explicitly as false, or assertPublishable rejects the missing image/packages.
      const res = await request(app).post("/api/v1/admin/services").set("Authorization", `Bearer ${token}`).send({ name: "Sportska Masaza", isActive: false });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.aktivna, false);
    });

    it("creates a fully published service with packages and image in one call", async () => {
      const token = await loginAsAdmin(app, "admin2@example.com");
      const res = await request(app)
        .post("/api/v1/admin/services")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Sportska Masaza",
          packages: [{ name: "60 minuta", duration: 60, totalPrice: 3000 }],
          image: { img: "/images/services/masaza.webp", imgDesc: "Sportska masaza" },
          isActive: true,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.aktivna, true);
      const serviceId = res.body.data.id;

      const updateRes = await request(app).put(`/api/v1/admin/services/${serviceId}`).set("Authorization", `Bearer ${token}`).send({ shortDescription: "Opis" });
      assert.equal(updateRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/services/${serviceId}`).set("Authorization", `Bearer ${token}`);
      assert.equal(deleteRes.status, 200);
    });

    it("400s trying to publish (isActive:true) a service with no image", async () => {
      const token = await loginAsAdmin(app, "admin3@example.com");
      const res = await request(app)
        .post("/api/v1/admin/services")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Bez Slike", packages: [{ name: "60 minuta", duration: 60, totalPrice: 3000 }], isActive: true });

      // assertPublishable (service.service.js) - documenting the constraint, not a bug.
      assert.equal(res.status, 400);
    });
  });

  describe("packages", () => {
    async function createReferenceableService(token) {
      // isActive:false - avoids assertPublishable's image requirement (see the
      // service describe block above); these package tests only need the
      // service/variant to exist, not to be published.
      const res = await request(app)
        .post("/api/v1/admin/services")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Masaza za Paket", packages: [{ name: "60 minuta", duration: 60, totalPrice: 3000 }], isActive: false });
      return { serviceId: res.body.data.id, servicePackageId: res.body.data.varijante[0].id };
    }

    it("creates a package referencing a real service+variant, then updates and deletes it", async () => {
      const token = await loginAsAdmin(app, "admin4@example.com");
      const { serviceId, servicePackageId } = await createReferenceableService(token);

      const createRes = await request(app)
        .post("/api/v1/admin/packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Paket 5 Masaza",
          description: "Pet seansi sportske masaze",
          totalPrice: 12000,
          items: [{ service: serviceId, servicePackageId, sessions: 5 }],
        });
      assert.equal(createRes.status, 201);
      const packageId = createRes.body.data.id;

      const updateRes = await request(app).put(`/api/v1/admin/packages/${packageId}`).set("Authorization", `Bearer ${token}`).send({ totalPrice: 11000 });
      assert.equal(updateRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/packages/${packageId}`).set("Authorization", `Bearer ${token}`);
      assert.equal(deleteRes.status, 200);
    });

    it("400s when items reference a variant that doesn't belong to the given service", async () => {
      const token = await loginAsAdmin(app, "admin5@example.com");
      const { serviceId } = await createReferenceableService(token);

      const res = await request(app)
        .post("/api/v1/admin/packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Neispravan Paket",
          description: "Opis",
          totalPrice: 1000,
          items: [{ service: serviceId, servicePackageId: "aaaaaaaaaaaaaaaaaaaaaaaa", sessions: 1 }],
        });

      assert.equal(res.status, 400);
    });
  });

  describe("products", () => {
    it("creates, updates, and deletes a product with variations", async () => {
      const token = await loginAsAdmin(app, "admin6@example.com");

      const createRes = await request(app)
        .post("/api/v1/admin/products")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "ESMA Uredjaj", sku: "esma-001" });
      assert.equal(createRes.status, 201);
      const productId = createRes.body.data.id;

      const updateRes = await request(app)
        .put(`/api/v1/admin/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ variations: [{ label: "50ml", price: 2000, stock: 10 }] });
      assert.equal(updateRes.status, 200);

      const deleteRes = await request(app).delete(`/api/v1/admin/products/${productId}`).set("Authorization", `Bearer ${token}`);
      assert.equal(deleteRes.status, 200);
    });

    it("400s creating a product with a duplicate SKU", async () => {
      const token = await loginAsAdmin(app, "admin7@example.com");
      await request(app).post("/api/v1/admin/products").set("Authorization", `Bearer ${token}`).send({ name: "Proizvod A", sku: "dup-001" });

      const res = await request(app).post("/api/v1/admin/products").set("Authorization", `Bearer ${token}`).send({ name: "Proizvod B", sku: "dup-001" });
      assert.equal(res.status, 409);
    });
  });
});
