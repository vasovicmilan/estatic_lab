import { describe, it } from "node:test";
import assert from "node:assert/strict";
import resourceRepo from "../../../src/repositories/resource.repository.js";
import serviceRepo from "../../../src/repositories/service.repository.js";
import * as resourceService from "../../../src/services/resource.service.js";
import { buildResource, id } from "../../helpers/factories.js";

describe("resource.service", () => {
  describe("listResources", () => {
    it("maps repository results through the admin-list mapper and preserves pagination fields", async (t) => {
      t.mock.method(resourceRepo, "findResources", async () => ({
        data: [buildResource({ isActive: false })],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }));

      const result = await resourceService.listResources({ search: "soba" });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].aktivan, "Ne", "should be run through the admin mapper, not returned raw");
      assert.equal(result.total, 1);
    });
  });

  describe("getResourceById", () => {
    it("rejects a missing resourceId", async () => {
      await assert.rejects(() => resourceService.getResourceById(), (err) => err.statusCode === 400);
    });

    it("throws 404 when the resource doesn't exist", async (t) => {
      t.mock.method(resourceRepo, "findResourceById", async () => null);
      await assert.rejects(() => resourceService.getResourceById(id().toString()), (err) => err.statusCode === 404);
    });

    it("returns the admin-detail mapped shape when found", async (t) => {
      const resource = buildResource({ name: "Soba 2", capacity: 3 });
      t.mock.method(resourceRepo, "findResourceById", async () => resource);

      const result = await resourceService.getResourceById(resource._id.toString());

      assert.equal(result.naziv, "Soba 2");
      assert.equal(result.kapacitet, 3);
    });
  });

  describe("getResourceForEdit", () => {
    it("rejects a missing resourceId", async () => {
      await assert.rejects(() => resourceService.getResourceForEdit(), (err) => err.statusCode === 400);
    });

    it("throws 404 when the resource doesn't exist", async (t) => {
      t.mock.method(resourceRepo, "findResourceById", async () => null);
      await assert.rejects(() => resourceService.getResourceForEdit(id().toString()), (err) => err.statusCode === 404);
    });

    it("returns the raw-field edit shape (name/capacity, not naziv/kapacitet)", async (t) => {
      const resource = buildResource({ name: "Soba 2", capacity: 3 });
      t.mock.method(resourceRepo, "findResourceById", async () => resource);

      const result = await resourceService.getResourceForEdit(resource._id.toString());

      assert.equal(result.name, "Soba 2");
      assert.equal(result.capacity, 3);
    });
  });

  describe("getResourcesForSelect", () => {
    it("returns all resources (including inactive ones) through the select mapper", async (t) => {
      t.mock.method(resourceRepo, "findAllResources", async () => [buildResource({ isActive: true }), buildResource({ isActive: false })]);

      const result = await resourceService.getResourcesForSelect();

      assert.equal(result.length, 2);
      assert.equal(result[1].aktivan, false, "inactive resources must still be included, not filtered out");
    });
  });

  describe("getResourceByIdRaw", () => {
    it("returns null (not a thrown error) for a missing/falsy resourceId - callers treat this as 'no resource assigned'", async () => {
      const result = await resourceService.getResourceByIdRaw(null);
      assert.equal(result, null);
    });

    it("returns the raw unmapped document when found", async (t) => {
      const resource = buildResource();
      t.mock.method(resourceRepo, "findResourceById", async () => resource);

      const result = await resourceService.getResourceByIdRaw(resource._id.toString());

      assert.equal(result, resource);
    });
  });

  describe("getEffectiveCapacity", () => {
    it("returns null for a null resource (no resource assigned to the service)", () => {
      assert.equal(resourceService.getEffectiveCapacity(null), null);
    });

    it("returns the configured capacity when the resource is active", () => {
      assert.equal(resourceService.getEffectiveCapacity(buildResource({ isActive: true, capacity: 4 })), 4);
    });

    it("returns 0 when the resource is inactive, regardless of its configured capacity", () => {
      assert.equal(resourceService.getEffectiveCapacity(buildResource({ isActive: false, capacity: 4 })), 0);
    });
  });

  describe("createResource", () => {
    it("rejects missing data or a missing name", async () => {
      await assert.rejects(() => resourceService.createResource(), (err) => err.statusCode === 400);
      await assert.rejects(() => resourceService.createResource({ capacity: 2 }), (err) => err.statusCode === 400);
    });

    it("creates the resource and returns it re-fetched through the admin-detail mapper", async (t) => {
      const created = buildResource({ name: "Nova soba" });
      const createMock = t.mock.method(resourceRepo, "createResource", async () => created);
      t.mock.method(resourceRepo, "findResourceById", async () => created);

      const result = await resourceService.createResource({ name: "Nova soba", capacity: 2 });

      assert.equal(createMock.mock.calls.length, 1);
      assert.equal(result.naziv, "Nova soba");
    });
  });

  describe("updateResourceById", () => {
    it("rejects a missing resourceId", async () => {
      await assert.rejects(() => resourceService.updateResourceById(undefined, { name: "x" }), (err) => err.statusCode === 400);
    });

    it("throws 404 when the resource doesn't exist", async (t) => {
      t.mock.method(resourceRepo, "findResourceById", async () => null);
      await assert.rejects(
        () => resourceService.updateResourceById(id().toString(), { name: "x" }),
        (err) => err.statusCode === 404
      );
    });

    it("updates and returns the resource re-fetched through the admin-detail mapper", async (t) => {
      const existing = buildResource();
      const updated = buildResource({ _id: existing._id, name: "Preimenovana soba" });
      let call = 0;
      t.mock.method(resourceRepo, "findResourceById", async () => (call++ === 0 ? existing : updated));
      t.mock.method(resourceRepo, "updateResourceById", async () => updated);

      const result = await resourceService.updateResourceById(existing._id.toString(), { name: "Preimenovana soba" });

      assert.equal(result.naziv, "Preimenovana soba");
    });
  });

  describe("deleteResourceById", () => {
    it("rejects a missing resourceId", async () => {
      await assert.rejects(() => resourceService.deleteResourceById(), (err) => err.statusCode === 400);
    });

    it("throws 404 when the resource doesn't exist", async (t) => {
      t.mock.method(resourceRepo, "findResourceById", async () => null);
      await assert.rejects(() => resourceService.deleteResourceById(id().toString()), (err) => err.statusCode === 404);
    });

    it("blocks deletion when a Service still points at this resource, naming the services in the error", async (t) => {
      const resource = buildResource();
      t.mock.method(resourceRepo, "findResourceById", async () => resource);
      t.mock.method(serviceRepo, "findServices", async () => ({
        data: [{ name: "Terapeutska masaža" }],
        total: 1,
      }));
      const deleteMock = t.mock.method(resourceRepo, "deleteResourceById", async () => ({}));

      await assert.rejects(
        () => resourceService.deleteResourceById(resource._id.toString()),
        (err) => err.statusCode === 400 && err.message.includes("Terapeutska masaža")
      );
      assert.equal(deleteMock.mock.calls.length, 0, "must never delete while a dependent service still exists");
    });

    it("deletes cleanly when no service depends on this resource", async (t) => {
      const resource = buildResource();
      t.mock.method(resourceRepo, "findResourceById", async () => resource);
      t.mock.method(serviceRepo, "findServices", async () => ({ data: [], total: 0 }));
      const deleteMock = t.mock.method(resourceRepo, "deleteResourceById", async () => ({}));

      const result = await resourceService.deleteResourceById(resource._id.toString());

      assert.equal(deleteMock.mock.calls.length, 1);
      assert.deepEqual(result, { success: true });
    });
  });
});