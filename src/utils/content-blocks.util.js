/**
 * Transforms the raw ContentBlogSchema block array (Mongoose sub-documents,
 * English field names matching content.blog.schema.js) into the flat,
 * Serbian-labeled shape both the admin edit form's live preview and the
 * public-facing block-rendering partial expect. Despite the schema's name,
 * this isn't blog-specific - it's a generic "structured rich content" block
 * format, reused by Product's longDescription too (see product.mapper.js).
 *
 * NOTE: does not add a `kotva` (anchor id) to heading blocks - that's a
 * blog-specific table-of-contents feature (see blog.presenter.js's
 * buildTableOfContents), which mutates blocks with an anchor AFTER this
 * runs, only for the public blog post page. Anything else rendering these
 * blocks (product descriptions, blog admin previews) simply gets headings
 * without an id, which the shared render partial handles gracefully.
 */
export function renderContentBlocks(blocks = []) {
  return (blocks || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((block) => ({
      tip: block.type,
      tekst: block.text || null,
      nivo: block.level || null,
      slika: block.image ? { url: block.image.img, alt: block.image.imgDesc } : null,
      galerija: Array.isArray(block.gallery) ? block.gallery.map((img) => ({ url: img.img, alt: img.imgDesc })) : null,
      video: block.video || null,
      stavke: block.items || null,
      uredjeno: Boolean(block.ordered),
      izvor: block.meta || null,
      kolone: block.table?.columns || null,
      redovi: block.table?.rows || null,
      kartice: block.cards || null,
      naslovBloka: block.title || null,
      varijanta: block.variant || "info",
      faqStavke: block.faqItems || null,
      dugme: block.button?.text || block.button?.url ? { tekst: block.button.text, url: block.button.url } : null,
    }));
}

/**
 * Flattens a block array down to plain text - for anywhere that needs a
 * short summary rather than full markup (e.g. an SEO meta description
 * fallback, an admin list preview). Only pulls from blocks that carry
 * free-form prose (paragraph/heading/quote/callout) - a table's cell values
 * or a card's title, for instance, don't read naturally concatenated into a
 * sentence, so those are skipped rather than mixed in.
 */
export function contentBlocksToPlainText(blocks = []) {
  return (blocks || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter((block) => ["paragraph", "heading", "quote", "callout"].includes(block.type) && block.text)
    .map((block) => block.text.trim())
    .join(" ");
}

/**
 * Converts a plain-text description written with lightweight markdown-ish
 * conventions ("**Heading:**" lines, "- " bullets, "*italic note*"
 * paragraphs, blank-line-separated paragraphs) into a proper content-blocks
 * array. Written specifically to migrate the product catalog seed's existing
 * longDescription strings (see product-catalog.seed.js) after Product.
 * longDescription moved from a plain String to structured blocks - without
 * this, every one of those ~40 product descriptions would need to be
 * hand-rewritten block by block. Not a general-purpose Markdown parser (no
 * nested formatting, no inline bold/links, no numbered lists) - just enough
 * structure recognition to turn this specific, consistent style of text into
 * real headings/lists/paragraphs instead of showing literal "**" characters.
 */
export function markdownStringToBlocks(text) {
  if (!text) return [];

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks = [];
  let order = 0;

  for (const para of paragraphs) {
    const lines = para
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const headingMatch = lines[0].match(/^\*\*(.+?):\*\*\s*(.*)$/s);
    const bulletLines = lines.filter((l) => l.startsWith("- "));
    const restAreAllBullets = bulletLines.length === lines.length - 1;
    const wholeParaIsBullets = bulletLines.length === lines.length && lines.length > 0;

    if (headingMatch && restAreAllBullets && bulletLines.length > 0) {
      // "**Heading:**" followed by one or more "- item" lines
      blocks.push({ type: "heading", level: 3, text: headingMatch[1], order: order++ });
      blocks.push({ type: "list", items: bulletLines.map((l) => l.replace(/^- /, "")), ordered: false, order: order++ });
    } else if (headingMatch && lines.length === 1 && headingMatch[2]) {
      // "**Heading:** inline text on the same line"
      blocks.push({ type: "heading", level: 3, text: headingMatch[1], order: order++ });
      blocks.push({ type: "paragraph", text: headingMatch[2], order: order++ });
    } else if (headingMatch && lines.length === 1) {
      // "**Heading:**" alone, nothing after it
      blocks.push({ type: "heading", level: 3, text: headingMatch[1], order: order++ });
    } else if (wholeParaIsBullets) {
      // a bullet list with no preceding heading line
      blocks.push({ type: "list", items: bulletLines.map((l) => l.replace(/^- /, "")), ordered: false, order: order++ });
    } else if (/^\*[^*].*[^*]\*$/s.test(para)) {
      // "*a whole paragraph wrapped in single asterisks*" - the seed data's
      // convention for an aside/disclaimer note, not a real bold/italic run
      blocks.push({ type: "callout", variant: "info", text: para.slice(1, -1).trim(), order: order++ });
    } else {
      // plain paragraph - strip any stray ** markers rather than showing them
      // literally, since the paragraph block type has no inline-bold support
      blocks.push({ type: "paragraph", text: para.replace(/\*\*/g, ""), order: order++ });
    }
  }

  return blocks;
}

export default { renderContentBlocks, contentBlocksToPlainText, markdownStringToBlocks };
