// Shown only on the plain /blog landing page (no active search) - gives the
// page real, indexable body copy beyond just a grid of post cards, and frames
// what the blog is for before a visitor starts browsing categories/tags.
const BLOG_INTRO = {
  eyebrow: "Sa bloga",
  title: "Vodič kroz masaže, ESMA tretmane i negu lica i tela",
  lead:
    "Ovde objašnjavamo kako rade naši tretmani, čemu služe i kome su namenjeni - bez marketinških obećanja, već jasnim informacijama zasnovanim na iskustvu našeg tima terapeuta u Novom Sadu.",
  paragraphs: [
    "Estetski i wellness tretmani daju najbolje rezultate kada znate šta da očekujete - koliko traje tretman, da li postoje kontraindikacije i koliko poseta je potrebno da bi efekti bili vidljivi. Zato u svakom tekstu detaljno opisujemo tok tretmana, ko treba da bude oprezan i po čemu se pojedini pristupi razlikuju.",
  ],
  highlights: [
    {
      icon: "bi-journal-richtext",
      title: "Objašnjenja tretmana",
      text: "Kako funkcionišu ESMA tretmani, masaže i nega lica i tela - korak po korak, bez stručnog žargona.",
    },
    {
      icon: "bi-shield-check",
      title: "Bezbednost i kontraindikacije",
      text: "Kada je tretman bezbedan, a kada je potrebno prethodno mišljenje lekara.",
    },
    {
      icon: "bi-graph-up",
      title: "Realna očekivanja",
      text: "Koliko tretmana je obično potrebno i kada se mogu očekivati prvi vidljivi rezultati.",
    },
    {
      icon: "bi-tags",
      title: "Pregled po temama",
      text: "Pronađite tekstove po vrsti tretmana ili konkretnoj temi koja vas trenutno zanima.",
    },
  ],
};

// Builds the category filter bar shown at the top of every /blog view (plain
// list, category, and tag pages alike) - same pattern as /usluge and
// /prodavnica: real links to existing routes, not client-side filtering.
function buildCategoryTabs(categories = [], activeCategorySlug = null, totalCount = 0) {
  return [
    { label: "Sve objave", href: "/blog", count: totalCount, active: !activeCategorySlug },
    ...categories.map((cat) => ({
      label: cat.naziv,
      href: `/blog/kategorija/${cat.slug}`,
      count: cat.count || 0,
      active: cat.slug === activeCategorySlug,
    })),
  ];
}

// Builds the "search by topic" tag chips shown below the grid, with the
// current tag (if any) marked active - same pattern as /usluge.
function buildTagChips(tags = [], activeTagSlug = null) {
  return tags.map((tag) => ({
    label: tag.naziv,
    href: `/blog/tag/${tag.slug}`,
    active: tag.slug === activeTagSlug,
  }));
}

export function prepareBlogListData(result, { query = {}, categories = [], tags = [], totalCount = 0 } = {}) {
  const search = query.search || "";

  return {
    posts: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/blog",
      query,
    },
    categoryTabs: buildCategoryTabs(categories, null, totalCount),
    tagChips: buildTagChips(tags, null),
    search,
    intro: search ? null : BLOG_INTRO,
    breadcrumbs: [{ label: "Blog", url: null }],
  };
}

export function prepareBlogCategoryData(category, result, query = {}, { categories = [], tags = [], totalCount = 0 } = {}) {
  return {
    category,
    posts: result.data,
    categoryTabs: buildCategoryTabs(categories, category.slug, totalCount),
    tagChips: buildTagChips(tags, null),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/blog/kategorija/${category.slug}`,
      query,
    },
    breadcrumbs: [
      { label: "Blog", url: "/blog" },
      { label: category.naziv, url: null },
    ],
  };
}

export function prepareBlogTagData(tag, result, query = {}, { categories = [], tags = [], totalCount = 0 } = {}) {
  return {
    tag,
    posts: result.data,
    categoryTabs: buildCategoryTabs(categories, null, totalCount),
    tagChips: buildTagChips(tags, tag.slug),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/blog/tag/${tag.slug}`,
      query,
    },
    breadcrumbs: [
      { label: "Blog", url: "/blog" },
      { label: tag.naziv, url: null },
    ],
  };
}

// ---- View-shaping helpers for a single blog post ----------------------

// Serbian Latin diacritics -> plain ASCII, so heading anchors are clean URLs
// (e.g. "Šta je..." -> "sta-je...") rather than escaped Unicode.
const DIACRITIC_MAP = { š: "s", đ: "dj", č: "c", ć: "c", ž: "z", Š: "s", Đ: "dj", Č: "c", Ć: "c", Ž: "z" };

function slugifyHeading(str) {
  return String(str || "")
    .split("")
    .map((ch) => DIACRITIC_MAP[ch] || ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getInitials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function humanizeSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

// Builds the sticky table-of-contents from the post's own level-2 heading
// blocks, and writes a matching `kotva` (anchor) id directly onto each of
// those blocks so the template just renders `id="<%= block.kotva %>"` -
// the anchor is only ever computed once, here, so it can't drift out of
// sync between the TOC links and the headings they point to.
function buildTableOfContents(blocks = []) {
  const usedAnchors = new Set();
  const toc = [];

  blocks.forEach((block) => {
    if (block.tip !== "heading" || Number(block.nivo) !== 2) return;

    const base = slugifyHeading(block.tekst) || "sekcija";
    let anchor = base;
    let suffix = 2;
    while (usedAnchors.has(anchor)) {
      anchor = `${base}-${suffix}`;
      suffix++;
    }
    usedAnchors.add(anchor);

    block.kotva = anchor;
    toc.push({ label: block.tekst, href: `#${anchor}` });
  });

  return toc;
}

export function prepareBlogPostData(post, { relatedPosts = [] } = {}) {
  const toc = buildTableOfContents(post.sadrzaj || []);

  if (post.autor) {
    post.autor.inicijali = getInitials(post.autor.ime);
  }
  post.kategorijaLabel = post.kategorije && post.kategorije.length > 0 ? humanizeSlug(post.kategorije[0]) : null;

  return {
    post,
    relatedPosts,
    toc,
    breadcrumbs: [
      { label: "Blog", url: "/blog" },
      { label: post.naslov, url: null },
    ],
  };
}