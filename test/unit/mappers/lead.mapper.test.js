import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapLeadsForAdminList, mapLeadsToCsv, mapLeadForAdminDetail } from "../../../src/mappers/lead.mapper.js";
import { encryptField } from "../../../src/utils/encrypted-field.util.js";
import { buildPhoneRecord } from "../../../src/utils/phone.util.js";
import { id } from "../../helpers/factories.js";

function lead(o = {}) {
  return {
    _id: id(),
    firstName: "Ana",
    lastName: encryptField("Anić"),
    email: "ana@example.com",
    phone: buildPhoneRecord("064 123 4567"),
    segment: "kozmetika",
    source: "sajam-ns-2026",
    consentContact: true,
    consentMarketing: true,
    prizeLabel: "15% popusta",
    couponCode: "TOCAK-ABC234",
    couponValidUntil: new Date("2026-12-31"),
    coupon: { usedCount: 0 },
    createdAt: new Date("2026-11-09T10:00:00Z"),
    ...o,
  };
}

describe("lead.mapper", () => {
  it("shows the decrypted name and whether the coupon has been used", () => {
    const [open, used] = mapLeadsForAdminList([lead(), lead({ coupon: { usedCount: 1 } })]);
    assert.equal(open.imePrezime, "Ana Anić");
    assert.equal(open.iskoriscen, "Ne");
    assert.equal(used.iskoriscen, "Da");
    assert.equal(open.segment, "Kozmetika");
  });

  it("decrypts the phone in the detail view", () => {
    assert.equal(mapLeadForAdminDetail(lead()).osnovno.telefon, "0641234567");
  });

  it("exports a CSV with a BOM, a header row and decrypted contact data", () => {
    const csv = mapLeadsToCsv([lead()]);
    assert.ok(csv.startsWith("﻿"));
    const lines = csv.slice(1).split("\r\n");
    assert.equal(lines.length, 2);
    assert.match(lines[0], /"Email".*"Telefon".*"Kod"/);
    assert.match(lines[1], /"Anić"/);
    assert.match(lines[1], /"0641234567"/);
    assert.match(lines[1], /"TOCAK-ABC234"/);
  });

  it("neutralises spreadsheet formulas and escapes quotes in exported cells", () => {
    const csv = mapLeadsToCsv([lead({ firstName: '=HYPERLINK("http://x")', prizeLabel: 'Popust "20"' })]);
    assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`), csv);
    assert.ok(csv.includes('"Popust ""20"""'));
  });
});
