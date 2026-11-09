import { test } from "node:test";
import assert from "node:assert/strict";
import { validateExpertCreate, validateExpertUpdate } from "../../../src/middlewares/validators/expert.validator.js";

async function run(chain, body) {
  const req = { body, headers: {}, query: {}, params: {} };
  for (const mw of chain) {
    await new Promise((resolve) => {
      const r = mw(req, {}, resolve);
      if (r && typeof r.then === "function") r.then(resolve);
    });
  }
  return req;
}

for (const [name, chain] of [["create", validateExpertCreate], ["update", validateExpertUpdate]]) {
  const base = { firstName: "Marija", lastName: "Ilić", imageDesc: "" };

  test(`expert ${name}: services="" (prazan multiselect) nije greška`, async () => {
    const req = await run(chain, { ...base, services: "" });
    assert.equal(req.validationErrors?.services, undefined);
    assert.deepEqual(req.body.services, []);
  });

  test(`expert ${name}: jedna usluga kao string postaje niz`, async () => {
    const id = "6a58e23834555139d67ec185";
    const req = await run(chain, { ...base, services: id });
    assert.equal(req.validationErrors?.services, undefined);
    assert.deepEqual(req.body.services, [id]);
  });
}
