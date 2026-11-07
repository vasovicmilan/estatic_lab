/**
 * Shared helpers for the signed-in portals' lists (user /nalog, employee /moj-nalog,
 * partner /moj-partner-nalog) - the counterpart of admin-list.util.js for the screens that
 * are NOT built on views/admin/_list.ejs.
 *
 * Page size: ?limit= only accepts one of PORTAL_PAGE_SIZES (anything else falls back to the
 * list's default), so the "Po strani" pills in includes/pagination.ejs are the only way to
 * change it and nobody can request an unbounded page.
 *
 * Sorting: each list declares its own whitelist of named orders (`{ newest: {...}, ... }`);
 * ?sort=<key> picks one, unknown keys fall back to the default, so ?sort= can never be used to
 * sort on an arbitrary field.
 */
export const PORTAL_PAGE_SIZES = [10, 20, 50];

export function resolvePortalLimit(raw, defaultLimit = 10) {
  const parsed = parseInt(raw, 10);
  return PORTAL_PAGE_SIZES.includes(parsed) ? parsed : defaultLimit;
}

/** The `pagination` object includes/pagination.ejs expects, with the page-size pills switched on. */
export function buildPortalPagination(result, { basePath, query = {}, pageParam = "page" }) {
  return {
    currentPage: result.page,
    totalPages: result.totalPages,
    limit: result.limit,
    total: result.total,
    pageSizeOptions: PORTAL_PAGE_SIZES,
    pageParam,
    basePath,
    query,
  };
}

/**
 * options: { key: { label, sort } } - the first entry is the default.
 * Returns the Mongo sort object plus the select-box model the views render.
 */
export function resolvePortalSort(rawKey, options) {
  const keys = Object.keys(options);
  const key = typeof rawKey === "string" && Object.prototype.hasOwnProperty.call(options, rawKey) ? rawKey : keys[0];
  return {
    key,
    sort: options[key].sort,
    control: {
      value: key,
      options: keys.map((k) => ({ value: k, label: options[k].label })),
    },
  };
}

const MONEY_AND_DATE = (amountField) => ({
  newest: { label: "Najnovije prvo", sort: { createdAt: -1, _id: -1 } },
  oldest: { label: "Najstarije prvo", sort: { createdAt: 1, _id: 1 } },
  amountDesc: { label: "Najveći iznos", sort: { [amountField]: -1, _id: -1 } },
  amountAsc: { label: "Najmanji iznos", sort: { [amountField]: 1, _id: 1 } },
});

export const COMMISSION_SORTS = MONEY_AND_DATE("amount");
export const PAYOUT_SORTS = MONEY_AND_DATE("amount");
export const ORDER_SORTS = MONEY_AND_DATE("totalPrice");
export const ACTIVITY_SORTS = {
  newest: { label: "Najnovije prvo", sort: { timestamp: -1 } },
  oldest: { label: "Najstarije prvo", sort: { timestamp: 1 } },
};
