import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONTS_DIR = path.join(__dirname, "..", "assets", "fonts", "dejavu");

/**
 * Registers Unicode-capable fonts on a pdfkit document, under the names
 * "Body" / "Body-Bold" / "Mono".
 *
 * Why this exists: pdfkit's built-in "standard 14" fonts (Helvetica,
 * Helvetica-Bold, Times-Roman, ...) use WinAnsiEncoding (Windows-1252),
 * which simply does not contain š/đ/č/ć/ž (or their uppercase forms) - these
 * are Latin Extended-A code points, outside WinAnsiEncoding's range. This
 * isn't a pdfkit bug or something fixable with escaping/encoding options; a
 * TrueType font that actually has those glyphs has to be embedded instead.
 * (Confirmed by generating a plain Helvetica PDF and inspecting its raw
 * bytes: `/BaseFont /Helvetica /Encoding /WinAnsiEncoding`.)
 *
 * DejaVu Sans / DejaVu Sans Mono were chosen because they're a complete,
 * well-established, permissively-licensed (Bitstream Vera license - free to
 * embed/redistribute, see the bundled LICENSE.txt) family with full Latin
 * Extended-A coverage, and - importantly - they were verified to actually
 * work with pdfkit's fontkit-based subsetting/embedding. A couple of other
 * candidates were tried first and rejected for concrete reasons: Google
 * Fonts' Inter, matching the site's own body font, only ships as .woff/
 * .woff2 (no .ttf) via npm, and pdfkit's bundled fontkit@2.0.4 throws
 * ("RangeError: Offset is outside the bounds of the DataView") when
 * embedding that particular .woff2 file. A locally available IBM Plex Mono
 * .ttf (matching the site's own price/data font) hit the same fontkit error
 * for a different, font-specific reason. DejaVu Sans Mono is used for the
 * "Mono" role instead - visually in the same monospace family/spirit as the
 * site's IBM Plex Mono, just a font actually confirmed to embed correctly.
 *
 * Usage: call once per document, right after creating it, then use
 * doc.font("Body") / .font("Body-Bold") / .font("Mono") instead of
 * "Helvetica" / "Helvetica-Bold" anywhere the text might contain Serbian
 * diacritics (which, in practice, is anywhere - so just always use these).
 */
export function registerReportFonts(doc) {
  doc.registerFont("Body", path.join(FONTS_DIR, "DejaVuSans.ttf"));
  doc.registerFont("Body-Bold", path.join(FONTS_DIR, "DejaVuSans-Bold.ttf"));
  doc.registerFont("Mono", path.join(FONTS_DIR, "DejaVuSansMono.ttf"));
  return doc;
}

export default { registerReportFonts };
