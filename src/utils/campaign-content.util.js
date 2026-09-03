import { ctaButton } from "./email-content.util.js";

// Relative links (e.g. a serviceReference/productReference block's button.url,
// which is normally just "/usluge/neki-tretman") don't work in an email client -
// there's no page context to resolve them against. Every link this renderer
// emits goes through this first.
function toAbsoluteUrl(url, baseUrl) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const HEADING_STYLES = {
  2: "font-size:22px; font-weight:800;",
  3: "font-size:18px; font-weight:700;",
  4: "font-size:15px; font-weight:700;",
};

function renderBlock(block, baseUrl) {
  switch (block.type) {
    case "heading": {
      const style = HEADING_STYLES[block.level] || HEADING_STYLES[2];
      return `<p style="${style} color:#2d2a26; margin:28px 0 12px; line-height:1.3;">${escapeHtml(block.text)}</p>`;
    }

    case "paragraph":
      return `<p style="font-size:15px; color:#3a352f; line-height:1.7; margin:0 0 16px;">${escapeHtml(block.text)}</p>`;

    case "image":
      if (!block.image?.img) return "";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr><td>
          <img src="${toAbsoluteUrl(block.image.img, baseUrl)}" alt="${escapeHtml(block.image.imgDesc)}" width="100%" style="display:block; width:100%; height:auto; border-radius:8px;">
        </td></tr>
      </table>`;

    // cta/serviceReference/productReference are visually distinct on the web
    // (see content-blocks-render.ejs) but are the same title+text+button shape,
    // and read the same way in an email - one link-out prompt either way.
    case "cta":
    case "serviceReference":
    case "productReference": {
      if (!block.button?.url) return "";
      let html = "";
      if (block.title) html += `<p style="font-size:16px; font-weight:700; color:#2d2a26; margin:0 0 4px; text-align:center;">${escapeHtml(block.title)}</p>`;
      if (block.text) html += `<p style="font-size:14px; color:#6b655e; margin:0; text-align:center;">${escapeHtml(block.text)}</p>`;
      html += ctaButton(toAbsoluteUrl(block.button.url, baseUrl), block.button.text || "Pogledajte više");
      return html;
    }

    case "divider":
      return `<hr style="border:none; border-top:1px solid #e5ddd3; margin:28px 0;">`;

    default:
      // gallery/video/table/cards/callout/faq/quote/list - not in
      // CAMPAIGN_BLOCK_TYPES, so the admin editor shouldn't offer them for a
      // campaign, but skip silently (not throw) rather than break a whole send
      // over one stray block, e.g. left over from copy-pasting a blog post.
      return "";
  }
}

export function renderCampaignContentToEmailHtml(content = [], baseUrl) {
  return content
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((block) => renderBlock(block, baseUrl))
    .filter(Boolean)
    .join("\n");
}

export default { renderCampaignContentToEmailHtml };
