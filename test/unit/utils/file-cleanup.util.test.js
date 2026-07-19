import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { deleteUploadedFile, deleteUploadedFiles } from "../../../src/utils/file-cleanup.util.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_PATH = path.join(__dirname, "..", "..", "..", "src", "public");
const TEST_SUBDIR = path.join(PUBLIC_PATH, "images", "products");

describe("file-cleanup.util", () => {
  before(() => fs.ensureDirSync(TEST_SUBDIR));

  describe("deleteUploadedFile - safety checks", () => {
    it("does nothing (does not throw) for null/undefined/empty input", async () => {
      await deleteUploadedFile(null);
      await deleteUploadedFile(undefined);
      await deleteUploadedFile("");
    });

    it("refuses to touch a URL outside the managed /images or /videos tree", async () => {
      const outsidePath = path.join(__dirname, "canary.txt");
      fs.writeFileSync(outsidePath, "should not be touched");
      try {
        await deleteUploadedFile("/etc/passwd");
        await deleteUploadedFile("https://example.com/images/products/x.webp");
        assert.ok(fs.existsSync(outsidePath), "an unrelated file must never be deleted by this function");
      } finally {
        fs.removeSync(outsidePath);
      }
    });

    it("refuses a path containing '..' even if it starts with /images/ (path traversal)", async () => {
      const canaryOutsidePublic = path.join(PUBLIC_PATH, "..", "canary-traversal.txt");
      fs.writeFileSync(canaryOutsidePublic, "should not be touched");
      try {
        await deleteUploadedFile("/images/../../canary-traversal.txt");
        assert.ok(fs.existsSync(canaryOutsidePublic), "a path-traversal attempt must not escape the managed directory");
      } finally {
        fs.removeSync(canaryOutsidePublic);
      }
    });

    it("does not throw for a well-formed path that simply doesn't exist on disk", async () => {
      await deleteUploadedFile("/images/products/does-not-exist-xyz.webp");
    });
  });

  describe("deleteUploadedFile - actually deletes a real file", () => {
    it("removes a genuine file under the managed images tree", async () => {
      const testFile = path.join(TEST_SUBDIR, "test-cleanup-target.webp");
      fs.writeFileSync(testFile, "fake image content");
      assert.ok(fs.existsSync(testFile));

      await deleteUploadedFile("/images/products/test-cleanup-target.webp");

      assert.ok(!fs.existsSync(testFile), "the file should actually be gone from disk");
    });
  });

  describe("deleteUploadedFiles - batch", () => {
    it("deletes every file in the list", async () => {
      const fileA = path.join(TEST_SUBDIR, "batch-a.webp");
      const fileB = path.join(TEST_SUBDIR, "batch-b.webp");
      fs.writeFileSync(fileA, "a");
      fs.writeFileSync(fileB, "b");

      await deleteUploadedFiles(["/images/products/batch-a.webp", "/images/products/batch-b.webp"]);

      assert.ok(!fs.existsSync(fileA));
      assert.ok(!fs.existsSync(fileB));
    });

    it("silently skips falsy entries in the list instead of throwing", async () => {
      await deleteUploadedFiles([null, undefined, ""]);
    });

    it("handles an empty array", async () => {
      await deleteUploadedFiles([]);
    });

    it("handles being called with no argument at all", async () => {
      await deleteUploadedFiles();
    });
  });
});