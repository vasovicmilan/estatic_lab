// Shared body-content builders used across the email templates in ../views/emails.
// These used to live inside _helpers.ejs, included per-template via
// `<% include("_helpers") %>` - that doesn't actually work in EJS: a function
// defined inside an include()'d partial is scoped to that partial's own compiled
// function and never becomes available in the including template, no matter how
// the include is written. (A separate, compounding bug in that same file - a
// literal EJS closing-tag sequence quoted inside a comment - also broke EJS's
// tokenizer itself, which is what actually surfaced in production logs. Both
// together took down every email template that used this file.)
//
// The correct place to share plain JS helpers across many EJS templates is as
// render-time locals, not as an include - see email.service.js's renderTemplate(),
// which spreads these into every template's data automatically. No email template
// needs to import or include anything to use them.

export function infoRow(label, value) {
  return `<tr>
    <td style="padding:11px 0; font-size:13px; color:#9b9490; border-bottom:1px solid #f0ebe6; vertical-align:top;">${label}</td>
    <td style="padding:11px 0; font-size:14px; color:#2d2a26; font-weight:600; text-align:right; border-bottom:1px solid #f0ebe6; vertical-align:top;">${value}</td>
  </tr>`;
}

export function infoTable(rowsHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf8f6; border-radius:8px; margin:0 0 24px;">
    <tr><td style="padding:6px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
    </td></tr>
  </table>`;
}

export function statusTone(status) {
  const s = (status || "").toLowerCase();
  if (/(otkaz|odbij|rasprod|greš)/.test(s)) return "red";
  if (/(potvrd|isporuč|završ|odobr|isplać|aktiv)/.test(s)) return "green";
  if (/(čeka|obrad|nisko)/.test(s)) return "amber";
  return "gray";
}

export function badge(text, tone) {
  const tones = { green: ["#e8f3ea", "#2f7a42"], red: ["#fbeae8", "#b3402f"], amber: ["#fdf1de", "#a5690a"], gray: ["#f1efec", "#6b655e"] };
  const c = tones[tone] || tones.gray;
  return `<span style="display:inline-block; padding:5px 14px; border-radius:100px; background-color:${c[0]}; color:${c[1]}; font-size:12px; font-weight:700;">${text}</span>`;
}

export function ctaButton(url, label) {
  return `<p style="text-align:center; margin:28px 0 4px;">
    <a href="${url}" style="background-color:#7a5c3e; color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:700; display:inline-block;">${label}</a>
  </p>`;
}

export function linkFallback(url) {
  return `<p style="font-size:12px; color:#aca59d; line-height:1.6; margin:20px 0 0; text-align:center;">
    Dugme ne radi? Kopirajte link u pregledač:<br>
    <a href="${url}" style="color:#7a5c3e; word-break:break-all;">${url}</a>
  </p>`;
}

export default { infoRow, infoTable, statusTone, badge, ctaButton, linkFallback };