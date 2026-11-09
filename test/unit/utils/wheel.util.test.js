import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickWeighted, buildSpinPlan, generateWheelCode, secureRandom, SPIN_MIN_TURNS, SPIN_MAX_TURNS } from "../../../src/utils/wheel.util.js";

describe("wheel.util", () => {
  describe("pickWeighted", () => {
    const items = [
      { key: "a", weight: 50 },
      { key: "b", weight: 30 },
      { key: "c", weight: 20 },
    ];

    it("maps the roll onto the weight ranges (0-50 -> a, 50-80 -> b, 80-100 -> c)", () => {
      assert.equal(pickWeighted(items, () => 0).key, "a");
      assert.equal(pickWeighted(items, () => 0.49).key, "a");
      assert.equal(pickWeighted(items, () => 0.5).key, "b");
      assert.equal(pickWeighted(items, () => 0.79).key, "b");
      assert.equal(pickWeighted(items, () => 0.8).key, "c");
      assert.equal(pickWeighted(items, () => 0.999).key, "c");
    });

    it("never picks a zero-weight item", () => {
      const only = [{ key: "off", weight: 0 }, { key: "on", weight: 1 }];
      for (let i = 0; i < 50; i++) assert.equal(pickWeighted(only).key, "on");
    });

    it("returns null when nothing has a positive weight", () => {
      assert.equal(pickWeighted([{ key: "x", weight: 0 }]), null);
      assert.equal(pickWeighted([]), null);
    });

    it("follows the configured chances over many real draws", () => {
      const counts = { a: 0, b: 0, c: 0 };
      const N = 20000;
      for (let i = 0; i < N; i++) counts[pickWeighted(items).key]++;
      assert.ok(Math.abs(counts.a / N - 0.5) < 0.03, `a=${counts.a / N}`);
      assert.ok(Math.abs(counts.b / N - 0.3) < 0.03, `b=${counts.b / N}`);
      assert.ok(Math.abs(counts.c / N - 0.2) < 0.03, `c=${counts.c / N}`);
    });
  });

  describe("buildSpinPlan", () => {
    it("always stays within 3-9 full turns, and the stop position inside the slice (not on its edge)", () => {
      for (let i = 0; i < 2000; i++) {
        const { turns, offset } = buildSpinPlan();
        assert.ok(Number.isInteger(turns) && turns >= SPIN_MIN_TURNS && turns <= SPIN_MAX_TURNS, `turns=${turns}`);
        assert.ok(offset >= 0.15 && offset <= 0.85, `offset=${offset}`);
      }
    });

    it("can reach both ends of the turn range", () => {
      assert.equal(buildSpinPlan(() => 0).turns, SPIN_MIN_TURNS);
      assert.equal(buildSpinPlan(() => 0.9999).turns, SPIN_MAX_TURNS);
    });

    it("keeps the duration between roughly 5 and 9 seconds and longer for more turns", () => {
      const shortest = buildSpinPlan(() => 0);
      const longest = buildSpinPlan(() => 0.9999);
      assert.ok(shortest.durationMs >= 4500 && shortest.durationMs <= 5500, `${shortest.durationMs}`);
      assert.ok(longest.durationMs >= 8500 && longest.durationMs <= 9500, `${longest.durationMs}`);
      assert.ok(longest.durationMs > shortest.durationMs);
    });

    it("does not give everyone the same spin", () => {
      const seen = new Set();
      for (let i = 0; i < 200; i++) seen.add(buildSpinPlan().turns);
      assert.ok(seen.size >= 5, `only ${seen.size} different turn counts in 200 spins`);
    });
  });

  describe("generateWheelCode", () => {
    it("has the TOCAK- prefix and only unambiguous characters", () => {
      for (let i = 0; i < 200; i++) {
        assert.match(generateWheelCode(), /^TOCAK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      }
    });

    it("does not repeat across a few thousand codes", () => {
      const set = new Set();
      for (let i = 0; i < 3000; i++) set.add(generateWheelCode());
      assert.equal(set.size, 3000);
    });
  });

  it("secureRandom stays in [0, 1)", () => {
    for (let i = 0; i < 1000; i++) {
      const r = secureRandom();
      assert.ok(r >= 0 && r < 1);
    }
  });
});
