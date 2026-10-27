import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAdminSort } from "../../../../src/utils/admin-list.util.js";
import { prepareAppointmentListData, SORT_MAP as APPOINTMENT_SORT } from "../../../../src/presenters/admin/appointment/appointment.presenter.js";
import { preparePackagePurchaseListData, SORT_MAP as PURCHASE_SORT } from "../../../../src/presenters/admin/marketing/package-purchase.presenter.js";
import { prepareRoleListData, SORT_MAP as ROLE_SORT } from "../../../../src/presenters/admin/auth/role.presenter.js";
import { prepareNewsletterListData, SORT_MAP as NEWSLETTER_SORT } from "../../../../src/presenters/admin/marketing/news-letter.presenter.js";
import { preparePayoutRequestListData, SORT_MAP as PAYOUT_SORT } from "../../../../src/presenters/admin/marketing/payout-request.presenter.js";
import { prepareTempOrderListData, SORT_MAP as TEMP_ORDER_SORT } from "../../../../src/presenters/admin/order/temporary-order.presenter.js";
import { prepareLogHistoryListData, SORT_MAP as LOG_HISTORY_SORT } from "../../../../src/presenters/admin/logs/log-summary.presenter.js";

const EMPTY = { data: [], page: 1, totalPages: 1, limit: 10, total: 0 };

// Each admin list that was missing sorting: its presenter + the mongo fields its sortable columns must map to.
const LISTS = [
  { name: "termini", build: prepareAppointmentListData, map: APPOINTMENT_SORT, expected: { datum: "startTime", status: "status", konacnaCena: "finalPrice" } },
  { name: "kupljeni paketi", build: preparePackagePurchaseListData, map: PURCHASE_SORT, expected: { cena: "pricePaid", status: "status", kupljeno: "purchasedAt", istice: "expiresAt" } },
  { name: "role", build: prepareRoleListData, map: ROLE_SORT, expected: { naziv: "name", podrazumevana: "isDefault", prioritet: "priority", kreirana: "createdAt" } },
  { name: "newsletter", build: prepareNewsletterListData, map: NEWSLETTER_SORT, expected: { email: "email", status: "status", prijavljen: "subscribedAt" } },
  { name: "isplate", build: preparePayoutRequestListData, map: PAYOUT_SORT, expected: { earnerType: "earnerType", iznos: "amount", status: "status", zatrazeno: "requestedAt" } },
  {
    name: "privremene porudzbine",
    build: prepareTempOrderListData,
    map: TEMP_ORDER_SORT,
    expected: { email: "contactSnapshot.email", ukupnaCena: "totalPrice", zahtevaProceenuDostave: "requiresShippingQuote", istice: "tokenExpiration", kreirano: "createdAt" },
  },
  {
    name: "istorija logova",
    build: prepareLogHistoryListData,
    map: LOG_HISTORY_SORT,
    expected: { date: "date", ukupnoZahteva: "requests.total", greske: "logs.errorCount", prosecnoVreme: "perf.avgResponseTimeMs" },
  },
];

describe("admin list sorting - lists that were missing it", () => {
  for (const { name, build, map, expected } of LISTS) {
    describe(name, () => {
      it("maps each sortable column to the right database field", () => {
        assert.deepEqual(map, expected);
      });

      it("marks exactly the mapped columns as sortable in the table header", () => {
        const view = build(EMPTY, {});
        const sortableKeys = view.columns.filter((c) => c.sortable).map((c) => c.key).sort();

        assert.deepEqual(sortableKeys, Object.keys(map).sort());
      });

      it("exposes the active sort for the header arrow, and none for unknown / injected columns", () => {
        const firstKey = Object.keys(map)[0];

        assert.deepEqual(build(EMPTY, { sortBy: firstKey, sortDir: "asc" }).sort, { by: firstKey, dir: "asc" });
        assert.equal(build(EMPTY, { sortBy: "passwordHash", sortDir: "asc" }).sort, null);
      });

      it("turns ?sortBy/&sortDir into a mongo sort (with a stable _id tiebreak) and ignores anything not whitelisted", () => {
        const firstKey = Object.keys(map)[0];
        const field = map[firstKey];

        assert.deepEqual(resolveAdminSort({ sortBy: firstKey, sortDir: "asc" }, map), { [field]: 1, _id: -1 });
        assert.deepEqual(resolveAdminSort({ sortBy: firstKey }, map), { [field]: -1, _id: -1 });
        assert.equal(resolveAdminSort({ sortBy: "hacked", sortDir: "asc" }, map), undefined);
      });
    });
  }
});
