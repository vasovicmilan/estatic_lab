# Claude as an Assistant: Access Through API Tokens

**Status: implemented (phases 1 to 4).** Claude works in production as a separate account with its own role, through API tokens that you create and revoke in the panel. Whatever it creates or changes stays a draft until you publish or activate it (site texts are the exception, see below).

## 1. How it works, in short

- **Account + role.** Create an ordinary user (e.g. "Claude assistant") with the role **claude asistent**. It is an account without a password anyone actually uses.
- **Token.** In `/admin/api-tokeni` create a token for that account: name, scopes, lifetime (1 to 90 days). The secret (`elk_...`) is shown once; only a hash stays in the database.
- **Claude** sends `Authorization: Bearer elk_...` to `/api/v1/admin/*`.
- **Revoking** is a button on the same screen and works immediately. There is also a **"Pause all tokens"** switch (blocks all tokens at once while keeping them).

## 2. What Claude may and may not do

Three independent layers; each of them has to let a request through.

1. **Role permissions + token scopes.** The effective permissions are the intersection of the role's permissions and the chosen scopes. Permissions are read **live from the role on every request**, so a role change applies at once.
2. **Route allowlist** (`api-token-guard.middleware.js`). A token may use only the routes covered by the table below; everything else is 403 and recorded as `API_TOKEN_DENIED`.
3. **Forced drafts.** The server, not Claude, sets the draft state.

| Scope | Allowed | Forced |
|---|---|---|
| `blog` | reading posts, creating and editing a post, image upload (`/uploads/posts`, `/gallery`), reading, creating and editing categories and tags | `status = draft`, no scheduling. Editing a published post takes it off the site and back to draft |
| `catalog` | reading, creating and editing services, packages and products; image and gallery upload; reading resources; reading, creating and editing categories and tags | `isActive = false`. Editing an active item takes it off the site until you activate it |
| `materials` | reading, uploading and editing materials (PDF, catalogs, brochures up to 25 MB) | `isActive = false` |
| `site` | reading and editing site texts: home (hero and intro), about, FAQ, partnership program, why us, the intros for services, packages, shop, blog and team, the contact page and the **SEO titles and descriptions of pages** (`seo-stranica`) | **Nothing: the change is public immediately** (there is no draft). The old and new value stay in the audit log |

**Never, whatever the role:** legal pages (privacy policy, terms), deleting anything, publishing or changing a post's status, SEO fields of individual products, services and posts (the `/seo` routes), activation, creating or sending newsletters, coupons, users, roles, orders, appointments, payouts, contact messages, logs, reports, site settings and texts not listed in the table, creating other tokens. A token works only on `/api/v1/admin/*` (not on `/me`, `/employee`, `/partner` or the cart).

Categories and tags: a new category or tag is created **inactive** (you activate it). Editing an existing one cannot change its active state, priority, domain or parent, so it is not taken off the site or moved in the structure; the other fields (name, description, content, SEO) change immediately and are visible in the audit log. Deleting is for the admin only. By default the assistant sees only active categories, and sees its own drafts when it asks for `?isActive=false`. Reading customers' personal data is not on the allowlist: text in fields that anyone on the internet can write must not reach the assistant as an instruction.

### Changing the scopes of an existing token

Scopes are part of the token and the role's permissions are the upper bound: **the effective set is the intersection**. So adding a permission to the role does not help while the token lacks the matching scope. In `/admin/api-tokeni`, in the scopes column, tick the scopes and save: it applies immediately and the secret stays the same. Because the seed restores the role to its definition in code, change the role's permissions in code (`roles.seed.js`), not by hand in the panel.

## 3. Request limits

Per token (not per IP address): 60 requests per minute, 20 writes per minute, 200 writes per day. Changed in `.env`: `RATE_LIMIT_TOKEN_MAX`, `RATE_LIMIT_TOKEN_WRITE_MAX`, `RATE_LIMIT_TOKEN_WRITE_DAY_MAX`. The general `apiLimiter` applies as well.

## 4. Audit

Every action goes to `/admin/logovi/audit` with the account and the mark `[api-token:<token name>]`. Special actions: `API_TOKEN_CREATED`, `API_TOKEN_REVOKED`, `API_ACCESS_PAUSED`, `API_ACCESS_RESUMED`, `API_TOKEN_DENIED` (an attempt outside the scope). The "role" filter has an entry for the Claude assistant.

## 5. Rollout, step by step

1. Put the changes on the server and restart the process with `pm2 restart <process-name>`.
2. Create the role (idempotent; it also restores the manager roles to their default definitions):
   `node src/database/seeds/run-roles-seed.js`
3. In `/admin/korisnici` create a user with the role **claude asistent** and a strong random password that is used nowhere else.
4. In `/admin/api-tokeni` create a token: the scopes you need and a lifetime (7 to 30 days recommended). Copy the secret.
5. Hand over the secret as a **secret environment variable** in the session settings, not as chat text.
6. In the network settings add the site's domain to the allowed domains. If Cloudflare has a WAF or bot protection, allow `/api/v1/admin/*` requests with the `Authorization` header.
7. Try it on one blog draft; check it in `/admin/blog` and in the log.

## 6. How Claude uses the API (basics)

- Image: `POST /api/v1/admin/uploads/posts` (or `products`, `services`, `packages`), multipart, field `file`; returns `{ img, imgDesc, ... }` to be put into the post or item body.
- Post: `POST /api/v1/admin/posts`, `PUT /api/v1/admin/posts/:id` (always ends up as a draft).
- Material: `POST /api/v1/admin/materials`, multipart: `file` + `title` + `description`. Changing the file: `PUT /api/v1/admin/materials/:id`.
- Services, packages, products: same as the rest of the admin API (`15-api-v1-reference.md`), always with `isActive = false`.

## 7. What you do afterwards

Review the drafts and publish or activate them: blog in `/admin/blog`, services, packages and products in their lists, materials in `/admin/materijali`. Apart from the site texts (`site` scope), nothing Claude did reaches visitors without your click.

## 8. Known limitations

- Editing an active service, package or product takes it off the site until you restore it (by design: you confirm everything Claude touches). For a tiny fix that means a short outage; if that matters, make the fix yourself.
- Site texts (`site` scope) have no draft: when Claude changes a text, it is public immediately. Legal pages, site settings, campaigns, coupons and the SEO fields of individual items are out of scope. Because the `site` scope includes the pages' SEO titles, grant it only when needed.
- The limit counters live in process memory; a `pm2` restart clears them.
- A token does not replace review: Claude can write wrong content, which is why things are drafts.
