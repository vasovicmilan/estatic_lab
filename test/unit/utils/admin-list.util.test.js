import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAdminSort, buildSortState, markSortableColumns, buildAdminPagination } from "../../../src/utils/admin-list.util.js";
import { resolveAdminLimit, ADMIN_PAGE_SIZES } from "../../../src/utils/pagination.util.js";

const MAP = { naziv: "name", kreiran: "createdAt" };

test("resolveAdminSort accepts only whitelisted column keys", () => {
  assert.deepEqual(resolveAdminSort({ sortBy: "naziv", sortDir: "asc" }, MAP), { name: 1, _id: -1 });
  assert.deepEqual(resolveAdminSort({ sortBy: "kreiran" }, MAP), { createdAt: -1, _id: -1 });
  assert.equal(resolveAdminSort({ sortBy: "password" }, MAP), undefined);
  assert.equal(resolveAdminSort({ sortBy: "__proto__" }, MAP), undefined);
  assert.equal(resolveAdminSort({}, MAP), undefined);
});

test("buildSortState / markSortableColumns", () => {
  assert.deepEqual(buildSortState({ sortBy: "naziv", sortDir: "asc" }, MAP), { by: "naziv", dir: "asc" });
  assert.equal(buildSortState({ sortBy: "x" }, MAP), null);
  const cols = markSortableColumns([{ key: "naziv" }, { key: "cena" }], MAP);
  assert.equal(cols[0].sortable, true);
  assert.equal(cols[1].sortable, undefined);
});

test("resolveAdminLimit only allows the admin page sizes", () => {
  assert.equal(resolveAdminLimit("50"), 50);
  assert.equal(resolveAdminLimit("7"), 10);
  assert.equal(resolveAdminLimit(undefined, 25), 25);
});

test("buildAdminPagination exposes the page-size selector fields", () => {
  const p = buildAdminPagination({ page: 2, totalPages: 5, limit: 25, total: 110 }, { basePath: "/admin/x", query: { a: 1 } });
  assert.equal(p.limit, 25);
  assert.equal(p.total, 110);
  assert.deepEqual(p.pageSizeOptions, ADMIN_PAGE_SIZES);
});
