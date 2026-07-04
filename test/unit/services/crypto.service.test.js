import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  comparePasswords,
  generateRandomToken,
  encrypt,
  decrypt,
  signJwt,
  verifyJwt,
  sha256,
} from "../../../src/services/crypto.service.js";

describe("crypto.service", () => {
  describe("hashPassword / comparePasswords", () => {
    it("round-trips: a hashed password compares true against the original", async () => {
      const hash = await hashPassword("mojaTajnaLozinka1");
      assert.equal(await comparePasswords("mojaTajnaLozinka1", hash), true);
    });

    it("a wrong password compares false", async () => {
      const hash = await hashPassword("tacnaLozinka1");
      assert.equal(await comparePasswords("pogresnaLozinka1", hash), false);
    });

    it("never stores the password in plaintext", async () => {
      const hash = await hashPassword("nemojMeCuvatiOtvoreno");
      assert.notEqual(hash, "nemojMeCuvatiOtvoreno");
      assert.ok(hash.startsWith("$2"), "bcrypt hashes start with a $2 version prefix");
    });
  });

  describe("generateRandomToken", () => {
    it("generates tokens of the expected hex length", () => {
      const token = generateRandomToken(32);
      assert.equal(token.length, 64); // 32 bytes -> 64 hex chars
    });

    it("never generates the same token twice", () => {
      const a = generateRandomToken();
      const b = generateRandomToken();
      assert.notEqual(a, b);
    });
  });

  describe("encrypt / decrypt", () => {
    it("round-trips arbitrary text", () => {
      const original = "Osetljiv podatak sa specijalnim karakterima: čćžšđ 123!";
      const encrypted = encrypt(original);
      assert.notEqual(encrypted, original);
      assert.equal(decrypt(encrypted), original);
    });

    it("produces a different ciphertext each time (random IV) even for the same input", () => {
      const a = encrypt("isti tekst");
      const b = encrypt("isti tekst");
      assert.notEqual(a, b);
      assert.equal(decrypt(a), decrypt(b));
    });
  });

  describe("signJwt / verifyJwt", () => {
    it("round-trips a payload", () => {
      const token = signJwt({ id: "123", role: "admin" });
      const decoded = verifyJwt(token);
      assert.equal(decoded.id, "123");
      assert.equal(decoded.role, "admin");
    });

    it("rejects a tampered token", () => {
      const token = signJwt({ id: "123" });
      const tampered = token.slice(0, -2) + "xx";
      assert.throws(() => verifyJwt(tampered));
    });
  });

  describe("sha256", () => {
    it("is deterministic for the same input", () => {
      assert.equal(sha256("isti-ulaz"), sha256("isti-ulaz"));
    });

    it("produces different hashes for different inputs", () => {
      assert.notEqual(sha256("a"), sha256("b"));
    });
  });
});