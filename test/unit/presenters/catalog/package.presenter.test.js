import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { preparePackageListData } from "../../../../src/presenters/catalog/package.presenter.js";

// Matches mapPackageForPublicCard's own output shape (see package.mapper.js) -
// preparePackageListData operates on already-mapped public package cards, not
// raw DB documents, so fixtures here mirror that mapped shape directly.
function buildMappedPackage(overrides = {}) {
  return {
    id: `pkg-${Math.random().toString(36).slice(2, 8)}`,
    naziv: "Test paket",
    slug: "test-paket",
    grupa: `standalone:${Math.random().toString(36).slice(2, 8)}`,
    brojSeansi: 1,
    najbolji: false,
    ...overrides,
  };
}

/**
 * BUG FIX regression coverage - see preparePackageListData's own comment.
 * This used to paginate the raw Package documents BEFORE grouping them into
 * display cards, which could split a 5/10-session tier pair across two
 * different pages - whichever page got only one half of the pair would show
 * that card with its toggle silently missing the other tier, even though
 * both packages existed and were active. Grouping now always happens across
 * the WHOLE catalog first; pagination is over the resulting cards.
 */
describe("package.presenter (catalog) - preparePackageListData", () => {
  it("groups tier siblings (same grupa) into one card, regardless of how many raw packages that represents", () => {
    const packages = [
      buildMappedPackage({ id: "p5", grupa: "tesla-tone:variant1", brojSeansi: 5 }),
      buildMappedPackage({ id: "p10", grupa: "tesla-tone:variant1", brojSeansi: 10 }),
    ];

    const view = preparePackageListData(packages, {}, { page: 1, perPage: 12 });

    assert.equal(view.packageGroups.length, 1, "two tiers of the same treatment must render as ONE card");
    assert.equal(view.packageGroups[0].tiers.length, 2);
  });

  it("never splits a tier pair across two pages - both tiers of the same group always land on the same page", () => {
    // 11 unrelated standalone packages (fills exactly page 1 at perPage:12,
    // one slot short) + 1 tier PAIR (2 raw packages, 1 group) as the 12th/13th
    // raw packages - if grouping happened after pagination, the pair could
    // easily be split by an off-by-one at the page boundary.
    const standalones = Array.from({ length: 11 }, (_, i) => buildMappedPackage({ id: `standalone-${i}`, grupa: `standalone:${i}` }));
    const tierPair = [
      buildMappedPackage({ id: "tier-5", grupa: "shared-group", brojSeansi: 5 }),
      buildMappedPackage({ id: "tier-10", grupa: "shared-group", brojSeansi: 10 }),
    ];

    const view = preparePackageListData([...standalones, ...tierPair], {}, { page: 1, perPage: 12 });

    // 11 standalone groups + 1 tier-pair group = 12 groups total -> all fit on page 1
    assert.equal(view.pagination.totalPages, 1);
    const tierGroup = view.packageGroups.find((g) => g.tiers.length === 2);
    assert.ok(tierGroup, "the tier pair must appear as a single 2-tier group, fully intact, on page 1");
  });

  it("paginates over GROUPS, not raw packages - totalPages reflects card count, not underlying document count", () => {
    // 6 tier pairs (12 raw packages, 6 groups) + 6 standalone packages (6 groups) = 12 groups total from 18 raw packages
    const pairs = Array.from({ length: 6 }, (_, i) => [
      buildMappedPackage({ id: `p${i}-5`, grupa: `group-${i}`, brojSeansi: 5 }),
      buildMappedPackage({ id: `p${i}-10`, grupa: `group-${i}`, brojSeansi: 10 }),
    ]).flat();
    const standalones = Array.from({ length: 6 }, (_, i) => buildMappedPackage({ id: `standalone-${i}`, grupa: `standalone:${i}` }));
    const allPackages = [...pairs, ...standalones];

    const view = preparePackageListData(allPackages, {}, { page: 1, perPage: 12 });

    assert.equal(allPackages.length, 18, "sanity check on the fixture itself");
    assert.equal(view.packageGroups.length, 12, "12 groups (cards) from 18 raw packages");
    assert.equal(view.pagination.totalPages, 1, "12 groups fit on one page at perPage:12 - pagination counts groups, not the 18 raw documents");
  });

  it("shows the correct second page of groups when there are more groups than fit on one page", () => {
    const groups = Array.from({ length: 14 }, (_, i) => buildMappedPackage({ id: `p${i}`, grupa: `standalone:${i}` }));

    const page1 = preparePackageListData(groups, {}, { page: 1, perPage: 12 });
    const page2 = preparePackageListData(groups, {}, { page: 2, perPage: 12 });

    assert.equal(page1.packageGroups.length, 12);
    assert.equal(page2.packageGroups.length, 2);
    assert.equal(page1.pagination.totalPages, 2);
    assert.equal(page2.pagination.currentPage, 2);
  });

  it("defaults to page 1 for an invalid/missing page value", () => {
    const groups = [buildMappedPackage()];
    const view = preparePackageListData(groups, {}, { page: "not-a-number" });
    assert.equal(view.pagination.currentPage, 1);
  });
});
