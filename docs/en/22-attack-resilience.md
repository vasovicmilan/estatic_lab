# 22. Resilience Against Botnet Attacks and Unnecessary Sessions

Written after the incident of 2026-11-25 (the site was unavailable for about 5 h, see the incident report). Cloudflare stopped 96.5% of the attack, but the rest went straight to the application, which created a MongoDB session for every request. This lists what changed in the code and how to check it.

## What changed

| Change | Where | Effect |
|---|---|---|
| Reading with `req.flash(type)` does not write to the session | `middlewares/flash.middleware.js` | reading messages no longer creates a session |
| The CSRF token is created only when it is printed | `config/csrf.config.js` (`lazyToken`) | an anonymous visit without a form writes no session |
| The meta tag, the footer newsletter form and the testimonial form (home, services, packages, articles) use `csrfTokenSoft` | `views/includes/head.ejs`, `footer.ejs`, `includes/components/testimonial-form.ejs` | empty for an anonymous visitor; a real token only for signed-in users or when the session already has one |
| `GET /csrf-token` | `config/csrf.config.js`, `routes/web/web.routes.js` | JavaScript fetches the token only when submitting a form or an AJAX request (`public/js/main.js`) |
| The global rate limiter comes right after static files | `app.js` | a request that will be refused costs no session, database or log line |
| The 429 response is plain text and the log gets one summary line per minute | `middlewares/rate-limiter.middleware.js` (`globalLimitExceeded`) | no error page rendering and no log line per request |
| `sitemap.xml` and `llms.txt` are cached for 10 minutes | `controllers/web/seo.controller.js` | one database query per 10 minutes instead of about ten per request |
| Request body limit 100 KB, 5 MB only for `/admin` and `/api` | `app.js` | public routes cannot take megabytes per request; an oversized body gets 413 |

## Limiters: what is counted

Real static files never reach the limiter, because `express.static` is mounted before it and answers by itself. So the limiter has **no exemptions by extension or prefix**: such exemptions used to let every non-existent "file" (e.g. `/blog/x.txt`), everything under `/api/` outside `/api/v1`, and `/api/v1/...x.json` reach routes, session and database with no limit at all (fixed 2026-11-26).

| Request | Limit (per minute, per IP address) |
|---|---|
| A real static file | not counted |
| `GET`/`HEAD` of a video or poster under `/uputstva` (exactly those two URL shapes) | `RATE_LIMIT_MEDIA_MAX`, 600, separate counter |
| `/api/v1/...` | `apiLimiter`, `RATE_LIMIT_API_MAX`, 120 |
| Everything else, including non-existent paths and the rest of `/api/` | `globalLimiter`, `RATE_LIMIT_GLOBAL_MAX`, 100 |
| `/admin` | `adminLimiter` on top of the general one, `RATE_LIMIT_ADMIN_MAX`, 300 |

Consequence: a missing image (404) also uses the visitor's quota, so broken image links should be fixed.

Pages that really show a form (sign-in, registration, contact, booking, cart, admin) still print the token in the form itself, so they still create a session. That is intended: the form is the purpose of the visit, and the limiter protects them before the session.

## How to check after a deploy

1. Number of sessions before and after: `db.sessions.countDocuments()`. Open the site from a private window several times; the number must not grow.
2. In the browser: private window, home page, newsletter sign-up from the footer must work (JavaScript fetches the token on submit).
3. Coupon on booking/cart: applying and removing must work (they use the same token).
4. `curl -I https://<domain>/sitemap.xml` must return `Cache-Control: public, max-age=600`.

## Not in the code, stays on the server

- Finding the cause of the memory exhaustion: run the application with `--max-old-space-size=1024 --heapsnapshot-near-heap-limit=1` (pm2: `--node-args`), then after the next crash analyse the snapshot in Chrome DevTools (Memory).
- `pm2 start ... --max-memory-restart 1G`, so the process restarts before it chokes.
- An external monitor on `/health`. If a Cloudflare rule challenges visitors from outside the region, it needs an exception for `/health` (and must include `and not cf.client.bot`, see `DEPLOYMENT.md`).
- The rate limiter lives in process memory: every restart clears it, and in cluster mode every process would have its own counter. That is why the application runs as **a single instance in fork mode** (see `DEPLOYMENT.md`).
