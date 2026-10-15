import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareUserActivityTabData } from "../../../../src/presenters/user/activity.presenter.js";

describe("user activity presenter", () => {
  it("exposes only label, time, status and ip - no changes, actor or raw action", () => {
    const data = prepareUserActivityTabData({
      data: [{ id: "1", timestamp: new Date(), action: "LOGIN_SUCCEEDED", actor: { email: "a@b.rs" }, changes: { x: 1 }, success: true, ip: "1.1.1.1" }],
      page: 1,
      totalPages: 1,
    });
    assert.deepEqual(Object.keys(data.items[0]).sort(), ["id", "ip", "opis", "uspesno", "vreme"]);
    assert.equal(data.items[0].opis, "Prijava na nalog");
    assert.equal(data.pagination.basePath, "/nalog/aktivnost");
  });
});
