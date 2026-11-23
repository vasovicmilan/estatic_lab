import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";
import fs from "fs-extra";
import materialRepo from "../../../src/repositories/material.repository.js";
import * as materialService from "../../../src/services/material.service.js";
import { saveMaterialBuffer, materialFilePath, toDownloadName } from "../../../src/config/material-upload.config.js";
import { id } from "../../helpers/factories.js";

let dir;
before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "materials-test-"));
  process.env.MATERIALS_DIR = dir;
});
after(async () => {
  delete process.env.MATERIALS_DIR;
  await fs.remove(dir);
});

const pdfFile = (name = "Ponuda 2026 (final).pdf") => ({ originalname: name, buffer: Buffer.from("%PDF-1.7 test"), mimetype: "application/pdf" });

function buildMaterial(overrides = {}) {
  return {
    _id: id(),
    title: "Ponuda",
    slug: "ponuda",
    description: "",
    isActive: true,
    viewCount: 0,
    downloadCount: 0,
    file: { storedName: "x.pdf", originalName: "ponuda.pdf", mimeType: "application/pdf", size: 10 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("material-upload.config", () => {
  it("stores a valid file under a random name inside MATERIALS_DIR and sanitises the download name", async () => {
    const saved = await saveMaterialBuffer(pdfFile());
    assert.match(saved.storedName, /^[0-9a-f-]{36}\.pdf$/);
    assert.equal(saved.originalName, "ponuda-2026-final.pdf");
    assert.equal(saved.mimeType, "application/pdf");
    assert.ok(await fs.pathExists(path.join(dir, saved.storedName)));
  });

  it("REGRESSION: refuses bytes that are not what the extension claims, and writes nothing", async () => {
    const before = (await fs.readdir(dir)).length;
    await assert.rejects(() => saveMaterialBuffer({ originalname: "x.pdf", buffer: Buffer.from("<html>"), mimetype: "application/pdf" }), (e) => e.statusCode === 400);
    assert.equal((await fs.readdir(dir)).length, before);
  });

  it("materialFilePath never resolves outside the materials folder", () => {
    assert.equal(materialFilePath("../../etc/passwd"), null);
    assert.ok(materialFilePath("abc.pdf").startsWith(dir));
  });

  it("toDownloadName strips diacritics and unsafe characters", () => {
    assert.equal(toDownloadName("Čudesna ponuda đ!!.PDF"), "cudesna-ponuda-dj.pdf");
    assert.equal(toDownloadName("???.pdf"), "materijal.pdf");
  });
});

describe("material.service", () => {
  it("createMaterial requires a title and a file", async () => {
    await assert.rejects(() => materialService.createMaterial({}, {}), (e) => e.statusCode === 400);
    await assert.rejects(() => materialService.createMaterial({ title: "Ponuda" }, null), (e) => e.statusCode === 400);
  });

  it("createMaterial builds a unique slug from the title", async (t) => {
    const taken = new Set(["ponuda-za-partnere"]);
    t.mock.method(materialRepo, "materialSlugExists", async (slug) => taken.has(slug));
    let payload;
    t.mock.method(materialRepo, "createMaterial", async (data) => {
      payload = data;
      return { ...buildMaterial(data), toObject() { return { ...buildMaterial(data) }; } };
    });
    const saved = await saveMaterialBuffer(pdfFile());

    await materialService.createMaterial({ title: "Ponuda za partnere" }, saved);

    assert.equal(payload.slug, "ponuda-za-partnere-2");
    assert.equal(payload.isActive, true);
  });

  it("createMaterial removes the already-written file when saving the document fails", async (t) => {
    t.mock.method(materialRepo, "materialSlugExists", async () => false);
    t.mock.method(materialRepo, "createMaterial", async () => {
      throw new Error("db down");
    });
    const saved = await saveMaterialBuffer(pdfFile());

    await assert.rejects(() => materialService.createMaterial({ title: "Ponuda" }, saved), /db down/);
    assert.equal(await fs.pathExists(path.join(dir, saved.storedName)), false);
  });

  it("updateMaterialById with a new file replaces it and deletes the old one, slug untouched", async (t) => {
    const oldFile = await saveMaterialBuffer(pdfFile("stara.pdf"));
    const newFile = await saveMaterialBuffer(pdfFile("nova.pdf"));
    const existing = buildMaterial({ file: oldFile });
    t.mock.method(materialRepo, "findMaterialById", async () => existing);
    let patch;
    t.mock.method(materialRepo, "updateMaterialById", async (_id, data) => {
      patch = data;
      return { ...existing, ...data };
    });

    await materialService.updateMaterialById(existing._id.toString(), { title: "Novo" }, newFile);

    assert.equal("slug" in patch, false);
    assert.equal(patch.file.storedName, newFile.storedName);
    assert.equal(await fs.pathExists(path.join(dir, oldFile.storedName)), false);
    assert.equal(await fs.pathExists(path.join(dir, newFile.storedName)), true);
  });

  it("deleteMaterialById removes the file from disk; 404 for an unknown id", async (t) => {
    const stored = await saveMaterialBuffer(pdfFile());
    t.mock.method(materialRepo, "deleteMaterialById", async () => buildMaterial({ file: stored }));
    await materialService.deleteMaterialById(id().toString());
    assert.equal(await fs.pathExists(path.join(dir, stored.storedName)), false);

    t.mock.method(materialRepo, "deleteMaterialById", async () => null);
    await assert.rejects(() => materialService.deleteMaterialById(id().toString()), (e) => e.statusCode === 404);
  });

  it("public page and download: inactive or missing material is a 404; a download is counted, a preview is not", async (t) => {
    t.mock.method(materialRepo, "findMaterialBySlug", async () => null);
    await assert.rejects(() => materialService.getPublicMaterial("nema"), (e) => e.statusCode === 404);

    t.mock.method(materialRepo, "findMaterialBySlug", async () => buildMaterial({ isActive: false }));
    await assert.rejects(() => materialService.getMaterialDownload("ponuda"), (e) => e.statusCode === 404);

    t.mock.method(materialRepo, "findMaterialBySlug", async () => buildMaterial());
    const downloads = t.mock.method(materialRepo, "incrementDownloadCount", async () => {});
    const result = await materialService.getMaterialDownload("ponuda");
    assert.equal(result.downloadName, "ponuda.pdf");
    assert.equal(downloads.mock.calls.length, 1);

    await materialService.getMaterialDownload("ponuda", { count: false });
    assert.equal(downloads.mock.calls.length, 1);
  });

  it("the public page exposes nothing internal (no stored file name, no counters)", async (t) => {
    t.mock.method(materialRepo, "findMaterialBySlug", async () => buildMaterial({ viewCount: 5 }));
    t.mock.method(materialRepo, "incrementViewCount", async () => {});
    const page = await materialService.getPublicMaterial("ponuda");
    assert.deepEqual(Object.keys(page).sort(), ["isImage", "naslov", "opis", "slug", "tip", "velicina"]);
  });
});
