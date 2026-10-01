import { ADMIN_PAGE_SIZES } from "./pagination.util.js";

/**
 * Shared helpers for the admin list screens (views/admin/_list.ejs).
 *
 * Sorting: a list declares which presenter column keys are sortable and which
 * Mongo field each one maps to (`sortMap`). The URL carries `?sortBy=<columnKey>&sortDir=asc|desc`.
 * `resolveAdminSort` turns that into a Mongo sort object for the service layer
 * (or `undefined` => repository default), and only ever accepts keys from the
 * whitelist, so ?sortBy= can never be used to sort on arbitrary fields.
 */
export function resolveAdminSort(query = {}, sortMap = {}) {
  const by = typeof query.sortBy === "string" ? query.sortBy : "";
  const field = Object.prototype.hasOwnProperty.call(sortMap, by) ? sortMap[by] : null;
  if (!field) return undefined;
  const dir = query.sortDir === "asc" ? 1 : -1;
  return { [field]: dir, _id: -1 };
}

/** What the view needs to render sort arrows: the active column + direction (or null). */
export function buildSortState(query = {}, sortMap = {}) {
  const by = typeof query.sortBy === "string" ? query.sortBy : "";
  if (!Object.prototype.hasOwnProperty.call(sortMap, by)) return null;
  return { by, dir: query.sortDir === "asc" ? "asc" : "desc" };
}

/** Marks columns sortable (col.sortable = true) when their key is in the sortMap. */
export function markSortableColumns(columns, sortMap = {}) {
  return columns.map((col) => (Object.prototype.hasOwnProperty.call(sortMap, col.key) ? { ...col, sortable: true } : col));
}

/**
 * The `pagination` object _list.ejs / includes/pagination.ejs expect, including
 * the fields that switch on the "Po strani" selector (limit, total, pageSizeOptions).
 */
export function buildAdminPagination(result, { basePath, query = {} }) {
  return {
    currentPage: result.page,
    totalPages: result.totalPages,
    limit: result.limit,
    total: result.total,
    pageSizeOptions: ADMIN_PAGE_SIZES,
    basePath,
    query,
  };
}
