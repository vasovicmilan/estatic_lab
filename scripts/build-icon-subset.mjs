#!/usr/bin/env node
// Subsets bootstrap-icons.woff2 down to only the glyphs Estetik Lab actually
// uses, instead of shipping the full ~2000-icon font (134 KiB woff2, 15+ KiB
// CSS) for the ~71 icons the site references. Same font-family, same class
// names (.bi-cart3 etc.) - existing templates need ZERO changes.
//
// Run via: npm run build:icons
// Rebuild whenever a new bi-* class is added to a view or to public/js/main.js.
//
// How it finds "used icons":
//   1. grep every bi-[a-z0-9-]+ token out of every .ejs/.js file under src/
//      (see BUG FIX note below for why this is the whole tree, not just
//      views/ and public/js/)
//   2. look up each class's codepoint in bootstrap-icons' own CSS
//   3. pyftsubset the font down to exactly those codepoints
//   4. write a new CSS containing only the @font-face + base rule + the used
//      icon rules, pulled verbatim from bootstrap-icons' own CSS so the
//      codepoints can never drift out of sync with the subset font
//
// BUG FIX: this used to scan only src/views/**/*.ejs + src/public/js/*.js.
// That missed every icon defined as a literal string in the presenter layer
// and handed to a template as data - e.g. src/presenters/public/index.presenter.js's
// WHY_US array (icon: "bi-cpu", "bi-patch-check", "bi-person-heart", "bi-flower1")
// or src/presenters/catalog/service.presenter.js's feature list - since the
// .ejs itself only ever contains a variable like `class="bi <%= item.icon %>"`,
// never the literal class name. Result: those icons silently never made it
// into the subset font (blank glyph, invisible), while any icon that happened
// to *also* appear literally somewhere in a template kept working - which is
// why some of a page's icons rendered and others right next to them didn't,
// with no pattern visible from the template alone. Now scans every .ejs/.js
// file under src/ (presenters, services, mappers, seeds, etc. included), not
// just the two directories where an icon class is written as literal markup.
//
// Requires Python's fonttools (with the woff2/brotli extra) on PATH:
//   pip install fonttools brotli --break-system-packages

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SRC_FONT = path.join(ROOT, "node_modules/bootstrap-icons/font/bootstrap-icons.css");
const SRC_WOFF2 = path.join(ROOT, "node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2");
const SCAN_ROOT = path.join(ROOT, "src");
const OUT_DIR = path.join(ROOT, "src/public/css");
const OUT_FONTS_DIR = path.join(ROOT, "src/public/fonts");
const OUT_CSS = path.join(OUT_DIR, "bootstrap-icons.subset.css");
const OUT_WOFF2 = path.join(OUT_FONTS_DIR, "bootstrap-icons.subset.woff2");

// Generated output lives under src/public/css and src/public/fonts - excluded
// from the scan since they're build artifacts, not sources of truth for what
// icons are "used" (scanning the generated subset CSS back into its own input
// would be harmless but pointless, and the .woff2 is binary).
const SCAN_EXCLUDE_DIRS = new Set(["css", "fonts"]);

function collectUsedIconClasses() {
  const classes = new Set();
  const pattern = /bi-[a-z0-9-]+/g;
  const exts = [".ejs", ".js"];

  function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (dir === path.join(ROOT, "src/public") && SCAN_EXCLUDE_DIRS.has(entry.name)) continue;
        scanDir(path.join(dir, entry.name));
      } else if (exts.some((ext) => entry.name.endsWith(ext))) {
        const content = fs.readFileSync(path.join(dir, entry.name), "utf8");
        for (const match of content.matchAll(pattern)) classes.add(match[0]);
      }
    }
  }

  scanDir(SCAN_ROOT);

  // "bi" alone (no suffix) is the base icon class some markup uses directly
  // with a data attribute instead of a name suffix - keep the base rule
  // regardless, it costs nothing (no glyph attached to it).
  return classes;
}

function parseCodepoints(cssSource) {
  const map = new Map();
  const rulePattern = /\.(bi-[a-z0-9-]+)::before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)";?\s*\}/g;
  for (const match of cssSource.matchAll(rulePattern)) {
    map.set(match[1], match[2]);
  }
  return map;
}

function main() {
  if (!fs.existsSync(SRC_FONT) || !fs.existsSync(SRC_WOFF2)) {
    console.error("bootstrap-icons not found in node_modules - run npm install first.");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(OUT_FONTS_DIR, { recursive: true });

  const usedClasses = collectUsedIconClasses();
  const fullCss = fs.readFileSync(SRC_FONT, "utf8");
  const codepointMap = parseCodepoints(fullCss);

  const missing = [];
  const rules = [];
  const unicodes = [];

  for (const cls of [...usedClasses].sort()) {
    const codepoint = codepointMap.get(cls);
    if (!codepoint) {
      missing.push(cls);
      continue;
    }
    rules.push(`.${cls}::before { content: "\\${codepoint}"; }`);
    unicodes.push(`U+${codepoint.toUpperCase()}`);
  }

  if (missing.length > 0) {
    // Not fatal - could be a typo'd class, or a non-icon "bi-" token (there
    // aren't any today, but fail soft rather than blocking the whole build).
    console.warn(`WARNING: ${missing.length} bi-* class(es) found in source but not in bootstrap-icons' own CSS (typo?):`, missing);
  }

  if (unicodes.length === 0) {
    console.error("No icon codepoints resolved - refusing to write an empty font subset.");
    process.exit(1);
  }

  console.log(`Subsetting bootstrap-icons.woff2 to ${unicodes.length} glyph(s)...`);
  execSync(
    `pyftsubset "${SRC_WOFF2}" --output-file="${OUT_WOFF2}" --unicodes=${unicodes.join(",")} --flavor=woff2 --no-layout-closure`,
    { stdio: "inherit" }
  );

  const subsetCss = `/*!
 * Bootstrap Icons (subset) - generated by scripts/build-icon-subset.mjs
 * from bootstrap-icons v1.13.1 (https://icons.getbootstrap.com/), MIT licensed.
 * Contains only the ${unicodes.length} glyphs actually used in src/views + public/js/main.js.
 * DO NOT hand-edit - rerun \`npm run build:icons\` instead.
 */

@font-face {
  font-display: swap;
  font-family: "bootstrap-icons";
  src: url("/fonts/bootstrap-icons.subset.woff2?v=${Date.now()}") format("woff2");
}

.bi::before,
[class^="bi-"]::before,
[class*=" bi-"]::before {
  display: inline-block;
  font-family: bootstrap-icons !important;
  font-style: normal;
  font-weight: normal !important;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  vertical-align: -.125em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

${rules.join("\n")}
`;

  fs.writeFileSync(OUT_CSS, subsetCss);

  const originalSize = fs.statSync(SRC_WOFF2).size;
  const subsetSize = fs.statSync(OUT_WOFF2).size;
  console.log(`Done: ${unicodes.length} icons, font ${(originalSize / 1024).toFixed(1)} KiB -> ${(subsetSize / 1024).toFixed(1)} KiB`);
}

main();
