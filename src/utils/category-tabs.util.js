// Shared by product.presenter.js and service.presenter.js (and any future
// catalog-style listing) - groups a flat category list (all categories in the
// domain, regardless of depth) into one chip-row per hierarchy level,
// following the currently active category's ancestor chain. E.g. viewing
// "HL/Skin" (Kozmetika > HL/Skin) shows row 0 = [Aparati i oprema, Kozmetika*,
// Potrošni materijal], row 1 = [Kozmetički proizvodi..., HL/Skin*] (children
// of Kozmetika), row 2 = [Nega lica, Nega tela] (HL/Skin's own children - none
// marked active, since we're viewing HL/Skin itself, not one of its children
// yet - this last row is just the natural final step of the loop below, not
// special-cased).
//
// This replaces what used to be a single flat row per listing page - every
// category, top-level device hubs and deeply nested brand pages alike, dumped
// into one confusing row. The category model itself is untouched; this
// purely regroups data that was already there (each category's own `parent`
// field, exposed by mapCategoryForPublic) into a shape the template can
// render tier by tier.
//
// `basePath` is the domain's category URL prefix, e.g. "/prodavnica/kategorija"
// for products or "/usluge/kategorija" for services - kept as a parameter
// rather than hardcoded so this one function serves every catalog domain.
export function buildCategoryTabRows(categories = [], activeCategorySlug = null, totalCount = 0, { basePath, allLabel } = {}) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const childrenByParent = new Map();
  for (const cat of categories) {
    const key = cat.parent || "root";
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(cat);
  }

  const active = categories.find((c) => c.slug === activeCategorySlug) || null;

  // walk from the active category up to its root-most ancestor, then reverse
  // so index 0 is the top-level ancestor and the last entry is the active
  // category itself.
  const ancestorChain = [];
  let node = active;
  let guard = 0; // same cycle guard as findCategoryAndDescendantIds - a bad parent
  // link shouldn't be able to hang this in a loop.
  while (node && guard < 20) {
    ancestorChain.unshift(node);
    node = node.parent ? byId.get(node.parent) : null;
    guard += 1;
  }

  function toChip(cat, isActive) {
    return { label: cat.naziv, href: `${basePath}/${cat.slug}`, count: cat.count || 0, active: isActive };
  }

  const rows = [];

  // row 0: top-level categories, plus the evergreen "see everything" link
  const topLevel = childrenByParent.get("root") || [];
  const topAncestor = ancestorChain[0];
  const allHref = basePath.replace(/\/kategorija$/, "");
  rows.push([
    { label: allLabel, href: allHref, count: totalCount, active: !activeCategorySlug },
    ...topLevel.map((cat) => toChip(cat, Boolean(topAncestor) && cat.id === topAncestor.id)),
  ]);

  // one row per remaining level of the ancestor chain: the children of each
  // ancestor, with whichever child leads toward (or is) the active category
  // marked active.
  for (let level = 0; level < ancestorChain.length; level += 1) {
    const parentId = ancestorChain[level].id;
    const children = childrenByParent.get(parentId) || [];
    if (children.length === 0) continue;
    const activeChild = ancestorChain[level + 1];
    rows.push(children.map((cat) => toChip(cat, Boolean(activeChild) && cat.id === activeChild.id)));
  }

  return rows;
}