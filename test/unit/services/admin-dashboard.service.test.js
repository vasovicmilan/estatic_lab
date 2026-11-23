import { describe, it } from "node:test";
import assert from "node:assert/strict";
import orderService from "../../../src/services/order.service.js";
import productService from "../../../src/services/product.service.js";
import serviceService from "../../../src/services/service.service.js";
import packageService from "../../../src/services/package.service.js";
import resourceService from "../../../src/services/resource.service.js";
import { getShopDashboard, getCatalogDashboard } from "../../../src/services/admin-dashboard.service.js";

const page = { total: 0, data: [] };

describe("admin-dashboard.service permissions", () => {
  it("shop: orders are not queried without manage_orders", async (t) => {
    t.mock.method(productService, "listProducts", async () => page);
    const orders = t.mock.method(orderService, "findOrders", async () => page);
    const r = await getShopDashboard({ permissions: ["manage_products"] });
    assert.equal(orders.mock.callCount(), 0);
    assert.equal(r.canOrders, false);
  });
  it("shop: orders queried with manage_orders", async (t) => {
    t.mock.method(productService, "listProducts", async () => page);
    const orders = t.mock.method(orderService, "findOrders", async () => ({ total: 2, data: [] }));
    const r = await getShopDashboard({ permissions: ["manage_products", "manage_orders"] });
    assert.equal(orders.mock.callCount(), 1);
    assert.equal(r.stats.pendingOrders, 2);
  });
  it("catalog: only the permitted half is queried", async (t) => {
    const s = t.mock.method(serviceService, "listServices", async () => page);
    const p = t.mock.method(packageService, "listPackages", async () => page);
    const r = t.mock.method(resourceService, "listResources", async () => page);
    await getCatalogDashboard({ permissions: ["manage_packages"] });
    assert.equal(s.mock.callCount(), 0);
    assert.equal(p.mock.callCount(), 3);
    assert.equal(r.mock.callCount(), 0);
  });
});
