# Marketing: SEO, blog, AI optimization and email campaigns

This file explains the platform's **marketing layer**: how the site becomes visible in search (SEO), how AI assistants and answer engines come to understand it (AI SEO), what the blog is for, and how the newsletter and automatic emails bring customers back. For each part it says **what the system does, why it is built that way and what that gains**. As in the rest of the documentation, known limitations are listed plainly.

Marketing is not a separate module with its own flags: SEO and the newsletter work in every instance, and the blog is the `blog` module (see `16-module-feature-flags.md`). When a module is off, its pages return 404, stay out of `sitemap.xml` and are not mentioned in `llms.txt`.

## The whole picture in one table

| Goal | What the system does | Where |
|---|---|---|
| Be found by search | Every page has a title, description, canonical address, Open Graph/Twitter cards and structured data (JSON-LD) | `src/seo/` |
| Let search know what exists | `sitemap.xml` is generated from the database, `robots.txt` from the enabled modules | `sitemap.service.js`, `seo.controller.js` |
| Be understood by AI assistants | `llms.txt` (generated from the database) + the same structured data + an open `robots.txt` | `llms-txt.service.js` |
| Publish content regularly | Blog with scheduled publishing, a block editor, FAQ blocks, categories and tags | `post.model.js`, `post-jobs.js` |
| Bring customers back | Newsletter with segments, scheduled campaigns, a welcome email and cart reminders | `campaign.service.js`, `news-letter.service.js`, `cart-reminder-jobs.js` |
| Make referrals pay off | The partner program (documented separately in `06-affiliate-partner-program.md`) | |

## 1. SEO (classic search)

### What every page gets

Every kind of content (service, package, product, blog post, category, tag, expert, static page) has its own "builder" in `src/seo/builders/`. All return the same result shape:

- A **title** with the site name as a suffix (not duplicated if the title already contains it) and a **description** truncated to the length search engines show.
- A **per-page `robots` tag**: `index, follow`, or `noindex, follow` if the content is marked non-indexable (`isIndexable`).
- A **canonical address** and **Open Graph / Twitter cards** (image, title, description), so sharing on social networks looks right.
- **Structured data (JSON-LD)**, but only what actually fits the page (table below).

| Page | Structured data |
|---|---|
| Every page | Business data: type `HealthAndBeautyBusiness` (with booking), `Store` (shop only) or `Organization`; address, contact, logo and **opening hours** |
| Service | `Service` with one `Offer` (price and currency) per active variant, FAQ (`FAQPage`) and a `BreadcrumbList` |
| Package, product | `Product` with brand and an `Offer` (price and currency); a package additionally has FAQ (`FAQPage`) |
| Home | `WebSite` with a search box (`SearchAction`) |
| Blog post | `BlogPosting` (author, publish and modify dates), FAQ extracted from content blocks, breadcrumb |

### The decisions behind it

**Ratings and reviews sit on the business (`provider`), not on the service.** Google's rich-result tool only shows stars for a limited list of types (e.g. local business, product), and `Service` is not on it. So the average rating and reviews from approved customer testimonials are written on the `HealthAndBeautyBusiness` inside the service. Same data, but in a form search can actually display. A testimonial goes public only after an admin approves it and the customer has given explicit consent.

**Opening hours come from settings, not from code.** If an admin has set the salon's fixed schedule (`/admin/sajt`), that is used. If not, the hours are derived from employees' shifts. Without the booking module there are no shifts, so opening hours are then not published.

**Empty fields are left out, not sent empty.** While the tax ID or registration number is not assigned, it does not appear in the structured data at all. Validators flag empty fields as errors, and an absent field is the correct way to say "not applicable".

**One source of truth for the site address.** Static pages used to have a canonical without `www` while service pages had it with `www`, depending on which address the visitor arrived on, so search saw duplicate pages. Both paths now use `BUSINESS.siteUrl` (`business.config.js`), so the canonical always has the same address.

**Static pages are edited from the admin panel.** For 13 pages (home, services, packages, shop, blog, our team, partners, contact, about, FAQ, privacy policy, terms, partner program) an admin changes the title, description and "do not index" without a code change. Only pages of enabled modules are shown.

### `sitemap.xml` and `robots.txt`

- **`sitemap.xml` is built from the database on every request** (`sitemap.service.js`), so it cannot go stale: a new service, product or post is in it as soon as it is active. Entries for services, packages, products, posts, experts and partners carry a `lastmod` from the real last-modified date. Categories and tags **do not**, because adding a product to a category does not change the category document itself, and an invented date would send search a false signal.
- **`robots.txt` is built from the enabled modules** (`buildRobotsTxt`). It always disallows `/admin`, `/nalog`, `/moj-nalog` and `/newsletter/odjava`. It disallows `/zakazivanje` only when booking is enabled. That page is not content but the state of one booking, with endlessly many variants through parameters. Crawlers were spending real crawl budget on it (about 2000 hits in two months in the access logs) and there is nothing to index.
- **Pages with personal or temporary state are `noindex`**: the booking steps, blog search results and the tutorials page (`/uputstva`).
- **Old links are not lost.** A redirect table (`Redirect`) lets a deleted or renamed page either permanently redirect (301) to a new one, or return 410 "permanently removed". 410 is better than a plain 404 for an address that used to be indexed, because it tells search to forget it instead of checking it forever.

### What this gains

A page that shows up in search looks tidy (title, description, stars, prices, opening hours), does not compete with itself (canonical), does not waste crawl budget on useless pages (`robots.txt`) and leaves no dead links (`sitemap.xml` + redirects). All of it stays correct when the catalog changes, because it is derived from data, not written by hand.

## 2. AI SEO (so AI assistants understand the site)

AI assistants and answer engines that reply in full sentences do not read a site like a person. They look for **facts they can quote**: what the business offers, at what price, where it is, when it is open and what customers say. The platform provides those facts in three places:

1. **`/llms.txt`** is a plain markdown index meant for language models (the `llmstxt.org` format): business description, contact, a list of services (up to 100) with descriptions, packages with prices, shop categories, the ten newest articles and key pages. It is **generated from the database** on every request, like `sitemap.xml`, so it cannot go stale. The business description follows the enabled modules, so a shop-only instance does not claim to offer online booking. A whole section of a disabled module is skipped, not left as an empty heading with a dead link.
2. **Structured data** from the previous section: prices per variant, ratings, opening hours, address and FAQ. These are the same facts an assistant looks for when it answers "how much does ... cost" or "are they open on Saturday".
3. **`robots.txt` blocks no crawler** (`User-agent: *`, `Allow: /`). The site is deliberately open to AI search too, because visibility in their answers is the goal. Only parts that should not be public even for people are disallowed.

**FAQ is the main "quotable" form.** Services have their own questions and answers, and in blog posts a FAQ block from the editor is automatically turned into `FAQPage` structured data. Question and answer are in a form an assistant can carry over verbatim.

**What the system does NOT do, and does not promise.** It does not measure whether or how often assistants cite the site. There is no tracking of AI appearances, and the recognition of robots by User-Agent (`bot-detection.util.js`) only exists so that robots are not given sessions, not for statistics. No assistant guarantees it uses `llms.txt`, so it is a cheap, maintainable signal, not a guaranteed channel. The real effect only becomes visible once measurement is introduced, for example asking customers "how did you find us" or reporting traffic by source.

## 3. Blog

The blog is the `blog` module and has three roles: regular content search engines like, answers to customer questions (and a source for AI answers, see above) and material for the newsletter.

**What a post has** (`post.model.js`):

- **Lifecycle:** draft, scheduled, published, archived. A scheduled post must have a future date, and a job that runs every 5 minutes (`post-jobs.js`) moves it to published when the date arrives. The transition is written to the audit log as a system action, like a manual status change. Content is prepared ahead and published when it should be, with nobody on call.
- **A block editor** instead of one text field: paragraph, heading, image, gallery, quote, list, video, table, cards, callout, **FAQ**, button, divider and references to services and products. Structure is something search and AI assistants can understand (headings, questions and answers), not a lump of HTML.
- **Reading time** is computed automatically (about 200 words a minute) on every content change.
- **The cover image is required.** Without it a post has no valid Open Graph card when shared.
- **Per-post SEO fields:** its own title, description (up to 160 characters), keywords and "do not index". If no SEO title is entered, the post title is used.
- **Featuring and a view counter:** posts can be featured (with their own order), and views are counted, so the most read can be shown.
- **Categories and tags** are shared between services, products and posts (separated by domain), and their archives are in `sitemap.xml`. The author is written as a `Person` in the structured data, or as the organization when there is none.

**Why scheduling and blocks:** a blog that is published in bursts and then goes quiet does not help in search, and an admin who has to be at the computer at 9am to click "publish" will not keep it up for long.

## 4. Newsletter and campaigns

### Subscribing, consent and unsubscribing

- A visitor subscribes through the form in the footer or through the JSON API, choosing **interests**: general (`general`), products (`products`) and partnership (`partnership`). A subscription with no choice gets `general`.
- **Proof of consent.** `consentedAt` is written once, at the first subscription, and never overwritten. It is the durable answer to "when did this person first agree", the question a data-protection request would ask. `subscribedAt`, in contrast, changes on every re-subscription.
- A repeat subscription **merges** interests rather than overwriting them, so adding "products" does not drop an earlier choice.
- Every email contains an **unsubscribe link with a unique token** (`/newsletter/odjava/:token`). An unsubscribed person is not deleted but gets the status `unsubscribed`, so it is visible that they must not receive a campaign. Unsubscribing does not require signing in.
- A **welcome email** is sent right at subscription.

### Campaigns (`campaign.service.js`)

An admin builds a campaign in the same block editor: heading, paragraph, image, button, **service reference**, **product reference** and divider. References are convenient because the campaign pulls the name, image and link from the catalog. Relative links are turned into absolute ones on sending, because a mail client could not resolve them.

- **Targeting:** by interests. An empty choice means **all active subscribers**.
- **Statuses:** draft, scheduled, sending, sent, failed. A scheduled campaign must have a future date. It can also be sent immediately ("Send now").
- **Scheduled sending** is done by a job that runs every 5 minutes (`campaign-jobs.js`).
- **No double sending.** The job first atomically "claims" the campaign (scheduled → sending), so only one of two overlapping runs can send it. If sending fails (e.g. the mail provider is down), the campaign goes to **failed** and is not put back in the queue for a retry: an automatic retry would send again to people who already received the message. The admin is notified through Telegram.
- **A sent campaign cannot be edited or deleted.** It is the historical record of what actually went out. The number of sent and failed emails is kept, and every send stays in the audit log (`CAMPAIGN_SENT`), both manual and scheduled (with the actor "system").

### Automatic emails that bring the customer back

| Email | When | What it offers |
|---|---|---|
| Welcome to a user | At registration | Coupon `DOBRODOSLI10`: 10% on services and packages, once per user (created automatically) |
| Cart reminder, step 1 | Cart unchanged for 24h | A reminder only, no discount |
| Cart reminder, step 2 | Cart unchanged for 72h | Coupon `VRATISE10` (10%) |

Cart reminders run only with the shop module, every morning at 7:30 and 7:40 (in the salon's time zone, not the server's), so an email does not arrive at 3am just because the cart happened to cross the threshold then. The next discount for the same person is possible only after 90 days, so a discount does not become a habit. Every cart change resets the counter, so abandoning it again counts as a new episode. The source of all constants is `marketing.config.js` and `cart-reminder.config.js`.

## 5. What this gives the business (summary)

| Decision | Reason | Benefit |
|---|---|---|
| SEO is derived from data, not written by hand | The catalog changes constantly | No stale titles, prices or links |
| Ratings on the business, not the service | Search shows stars only for certain types | Stars in results |
| `robots.txt` disallows state pages | Endless variants waste crawl budget | Search reaches real content |
| `llms.txt` + JSON-LD + open `robots.txt` | AI assistants look for quotable facts | A chance of being mentioned in AI answers |
| Blog with scheduled publishing | Regularity matters more than speed | Steady content without being on call |
| Segments and one-click unsubscribe | A sender must not flood people a topic does not interest | Fewer unsubscribes, tidy consent |
| Atomic campaign claim, no automatic retry | A double send is worse than a missed one | Nobody gets the same message twice |
| Reminder, then discount, with a 90-day pause | A discount is not given to everyone all the time | Cart recovery without discount habit |

## Known limitations

- **No campaign statistics.** Opens and clicks are not recorded, only the number sent and failed. It is not known which topic does better, so content decisions are made by impression or by business reports (sales, coupons), not by email response.
- **Sending is one by one,** in order, with no batching. For hundreds of subscribers that is fine; for tens of thousands it would need batching and rate limiting at the provider.
- **There is no separate "double opt-in" confirmation** of the address. A subscription counts immediately, and the proof is `consentedAt`. If legal advice requires confirmation by email, that is a new step.
- **The AI effect is not measured** (see section 2).
- **Structured data and `robots.txt` are reviewed per module** (business type, `Disallow` for booking) but are not checked with an external validator after every change. It is worth occasionally checking key pages in Google's rich results test.
- Legal texts (privacy policy, terms) are a starting point and must be reviewed by a lawyer, especially the parts about the newsletter and cookies.
