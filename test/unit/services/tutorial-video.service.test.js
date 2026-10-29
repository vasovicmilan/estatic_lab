import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "os";
import path from "path";
import * as svc from "../../../src/services/tutorial-video.service.js";

const guest = undefined;
const user = { permissions: [] };
const partner = { permissions: [], isPartner: true };
const employee = { permissions: [], isEmployee: true };
const admin = { permissions: ["access_admin_panel"] };

const item = (id, audience, order = 1) => ({
  id,
  audience,
  order,
  title: { sr: id, en: id },
  intro: { sr: "", en: "" },
  variants: {
    desktop: { durationSec: 10, files: { sr: `${id}/desktop.sr.mp4`, en: `${id}/desktop.en.mp4` }, poster: `${id}/desktop.jpg` },
    mobile: { durationSec: 10, files: { sr: `${id}/mobile.sr.mp4` }, poster: null },
  },
});

describe("tutorial-video.service", () => {
  let dir;
  const prevDir = process.env.TUTORIALS_DIR;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "tut-"));
    process.env.TUTORIALS_DIR = dir;
    svc.resetTutorialCache();
    const items = [item("a-public", "public"), item("b-user", "user"), item("c-partner", "partner"), item("d-employee", "employee"), item("e-admin", "admin")];
    await fs.writeJson(path.join(dir, "manifest.json"), { items });
    for (const i of items) {
      await fs.outputFile(path.join(dir, i.id, "desktop.sr.mp4"), "x");
      await fs.outputFile(path.join(dir, i.id, "desktop.jpg"), "x");
    }
  });

  afterEach(async () => {
    if (prevDir === undefined) delete process.env.TUTORIALS_DIR;
    else process.env.TUTORIALS_DIR = prevDir;
    svc.resetTutorialCache();
    await fs.remove(dir);
  });

  const ids = async (u) => (await svc.getCatalogForUser(u)).sections.flatMap((s) => s.items.map((i) => i.id));

  it("guest sees only public", async () => assert.deepEqual(await ids(guest), ["a-public"]));
  it("user sees public + user", async () => assert.deepEqual(await ids(user), ["a-public", "b-user"]));
  it("partner sees public + user + partner", async () => assert.deepEqual(await ids(partner), ["a-public", "b-user", "c-partner"]));
  it("employee sees public + user + employee", async () => assert.deepEqual(await ids(employee), ["a-public", "b-user", "d-employee"]));
  it("admin sees everything", async () => assert.equal((await ids(admin)).length, 5));

  it("canView follows the same rules", () => {
    assert.equal(svc.canView(guest, "user"), false);
    assert.equal(svc.canView(user, "partner"), false);
    assert.equal(svc.canView(partner, "employee"), false);
    assert.equal(svc.canView(admin, "employee"), true);
  });

  it("resolveFile returns the file and its audience for a known entry", async () => {
    const f = await svc.resolveFile({ id: "e-admin", device: "desktop", lang: "sr", kind: "video" });
    assert.equal(f.audience, "admin");
    assert.equal(f.contentType, "video/mp4");
  });

  it("resolveFile rejects unknown ids, devices, languages and missing files", async () => {
    assert.equal(await svc.resolveFile({ id: "nope", device: "desktop", lang: "sr", kind: "video" }), null);
    assert.equal(await svc.resolveFile({ id: "a-public", device: "tv", lang: "sr", kind: "video" }), null);
    assert.equal(await svc.resolveFile({ id: "a-public", device: "desktop", lang: "de", kind: "video" }), null);
    // listed in the manifest but not on disk
    assert.equal(await svc.resolveFile({ id: "a-public", device: "mobile", lang: "sr", kind: "video" }), null);
  });

  it("resolveFile never leaves the tutorials folder, even with a hostile manifest path", async () => {
    const bad = item("evil", "public");
    bad.variants.desktop.files.sr = "../../etc/passwd";
    await fs.writeJson(path.join(dir, "manifest.json"), { items: [bad] });
    svc.resetTutorialCache();
    assert.equal(await svc.resolveFile({ id: "evil", device: "desktop", lang: "sr", kind: "video" }), null);
  });

  it("missing manifest means an empty catalog, not an error", async () => {
    await fs.remove(path.join(dir, "manifest.json"));
    svc.resetTutorialCache();
    assert.equal((await svc.getCatalogForUser(admin)).total, 0);
  });
});
