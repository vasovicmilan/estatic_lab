import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PORTAL_PAGE_SIZES, resolvePortalLimit, buildPortalPagination, resolvePortalSort, COMMISSION_SORTS, ORDER_SORTS } from "../../../src/utils/portal-list.util.js";

describe("portal-list.util", () => {
  it("only accepts the offered page sizes, anything else falls back to the default", () => {
    for (const size of PORTAL_PAGE_SIZES) assert.equal(resolvePortalLimit(String(size)), size);
    assert.equal(resolvePortalLimit("7"), 10);
    assert.equal(resolvePortalLimit("100000"), 10);
    assert.equal(resolvePortalLimit(undefined, 20), 20);
    assert.equal(resolvePortalLimit("abc"), 10);
  });

  it("builds the pagination object with the page-size pills switched on", () => {
    const p = buildPortalPagination({ page: 2, totalPages: 5, limit: 20, total: 90 }, { basePath: "/x", query: { status: "paid" }, pageParam: "pastPage" });
    assert.deepEqual(p, { currentPage: 2, totalPages: 5, limit: 20, total: 90, pageSizeOptions: PORTAL_PAGE_SIZES, pageParam: "pastPage", basePath: "/x", query: { status: "paid" } });
  });

  it("resolves a whitelisted sort and falls back to the first (default) option for unknown keys", () => {
    assert.deepEqual(resolvePortalSort("oldest", COMMISSION_SORTS).sort, { createdAt: 1, _id: 1 });
    assert.deepEqual(resolvePortalSort("amountDesc", ORDER_SORTS).sort, { totalPrice: -1, _id: -1 });
    const fallback = resolvePortalSort("$where", COMMISSION_SORTS);
    assert.equal(fallback.key, "newest");
    assert.deepEqual(fallback.sort, { createdAt: -1, _id: -1 });
    assert.equal(fallback.control.value, "newest");
    assert.equal(fallback.control.options.length, 4);
    assert.equal(resolvePortalSort("toString", COMMISSION_SORTS).key, "newest");
  });
});
