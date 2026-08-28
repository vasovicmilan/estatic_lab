// Recognizes common crawler/bot User-Agent strings so callers can skip
// per-visitor session work (CSRF tokens, etc.) that bots never need - they
// don't submit forms, so giving them a token just pollutes the sessions
// collection with documents nobody will ever use.
//
// Deliberately conservative (well-known crawlers only, not a security
// control) - a false negative here just means one extra harmless session
// document, not a vulnerability. Never use this to gate anything security-
// sensitive, since User-Agent is trivially spoofable by anyone who wants to
// bypass it.
const BOT_USER_AGENT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|curl|wget|python-requests|python-urllib|go-http-client|headlesschrome|lighthouse|pingdom|uptimerobot|semrush|ahrefs|mj12bot|dotbot/i;

export function isLikelyBot(userAgent) {
  if (!userAgent) return false;
  return BOT_USER_AGENT_PATTERN.test(userAgent);
}

export default isLikelyBot;
