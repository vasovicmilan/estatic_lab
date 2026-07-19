import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTemporaryOrderFilter } from "../../../../src/repositories/filters/temporary-order.filter.js";
import { id } from "../../../helpers/factories.js";

describe("temporary-order.filter (buildTemporaryOrderFilter)", () => {
  it("returns an empty filter when nothing is provided", () => {
    assert.deepEqual(buildTemporaryOrderFilter(), {});
  });

  it("scopes to a single user", () => {
    const userId = id();
    assert.equal(buildTemporaryOrderFilter({ user: userId }).user, userId);
  });

  it("expired: true filters for tokenExpiration in the past", () => {
    const filter = buildTemporaryOrderFilter({ expired: true });
    assert.ok(filter.tokenExpiration.$lt instanceof Date);
  });

  it("expired: false filters for tokenExpiration still in the future", () => {
    const filter = buildTemporaryOrderFilter({ expired: false });
    assert.ok(filter.tokenExpiration.$gte instanceof Date);
  });

  it("omits the tokenExpiration filter entirely when expired isn't specified (shows both)", () => {
    assert.equal("tokenExpiration" in buildTemporaryOrderFilter(), false);
  });

  it("search matches contact snapshot fields only (no items to search - a temp order isn't final yet)", () => {
    const filter = buildTemporaryOrderFilter({ search: "ana" });
    assert.equal(filter.$or.length, 3);
    assert.deepEqual(filter.$or[2], { "contactSnapshot.email": { $regex: "ana", $options: "i" } });
  });

  it("omits $or when there's no search term", () => {
    assert.equal("$or" in buildTemporaryOrderFilter(), false);
  });
});