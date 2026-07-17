# Estatic Lab — Wellness & Aesthetic Studio Platform

> A full-stack booking, content management, and business operations platform built for a real-world spa / aesthetic wellness studio.
> Live at: [beautymedica.rs](https://beautymedica.rs)
> Repository: `vasovicmilan/estatic_lab`

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Why It Was Built](#2-why-it-was-built)
3. [Who It's For](#3-who-its-for)
4. [Technology Stack](#4-technology-stack)
5. [Architecture](#5-architecture)
6. [Domain Model & Business Logic](#6-domain-model--business-logic)
7. [Security](#7-security)
8. [Notifications & Integrations](#8-notifications--integrations)
9. [SEO](#9-seo)
10. [Testing](#10-testing)
11. [Project Structure](#11-project-structure)
12. [Environment Variables](#12-environment-variables)
13. [Running the Project](#13-running-the-project)
14. [Design Philosophy & Lessons Learned](#14-design-philosophy--lessons-learned)
15. [Roadmap](#15-roadmap)

---

## 1. What This Project Is

**Estatic Lab** is a complete web application for running a wellness/aesthetic studio's entire online presence and day-to-day operations: a public marketing site, an online appointment-booking system, a customer account area, an employee (therapist) portal, and a full internal admin panel — all in a single Node.js/Express codebase.

It is not a template or a generic "booking SaaS." It was built specifically around how *this* studio actually operates: individual services with multiple time/price variants, multi-session packages sold in person and redeemed online, a small team of therapists with their own weekly schedules, and a business owner who needs visibility into everything (appointments, contacts, coupons, newsletter subscribers, testimonials) from one place.

## 2. Why It Was Built

Running a small wellness studio day-to-day involves a lot of manual coordination: phone calls to book appointments, a paper or spreadsheet schedule, cash/card payments for pre-paid treatment packages tracked by memory or notebook, and no consistent way to follow up with clients or collect reviews. This project replaces all of that with a single system that:

- lets clients book a specific service variant, at a specific time, with a specific therapist (or "any available"), themselves, at any hour — no phone call needed;
- correctly prevents double-booking and enforces a buffer between appointments so therapists aren't left with zero turnaround time;
- tracks pre-paid multi-session packages accurately, so a client who bought "10 sessions" can't accidentally be given an 11th, and a session isn't marked "used" until it's actually delivered;
- gives the studio owner and staff a single admin panel to manage services, pricing, packages, coupons, blog content, and appointments, without touching a database directly;
- automatically notifies both the client and the internal team (by email and Telegram) at every meaningful event — booking, confirmation, cancellation, reassignment, new testimonial, new contact message;
- builds real SEO structure (meta tags, Open Graph, sitemaps, canonical URLs) for every service, package, blog post, and category page, since organic search traffic matters a lot for a local business.

## 3. Who It's For

- **Guests / prospective clients** — browse services and packages, read FAQs and reviews, book an appointment without creating an account (a lightweight "guest" account is created transparently behind the scenes).
- **Registered clients** — manage their upcoming and past appointments, see how many sessions remain on a purchased package, cancel within policy, leave a review.
- **Therapists (Employees)** — see their own daily schedule, appointment details, and update appointment status (confirm / complete / no-show / reject) for appointments assigned to them.
- **Studio admin / owner** — a permission-gated admin panel to run the entire business: services, packages, taxonomy (categories/tags), blog, coupons, newsletter, contact messages, testimonials, employees, experts, roles & permissions, and every appointment in the system.

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js, ES Modules (`"type": "module"`) |
| Web framework | Express 5 |
| Database | MongoDB via Mongoose 9 |
| Views | EJS (server-rendered, no SPA framework) |
| CSS framework | Bootstrap 5.3 + Bootstrap Icons |
| Sessions | `express-session` + `connect-mongo` (Mongo-backed session store) |
| Auth | Session-based auth + Google OAuth login; JWT (`jsonwebtoken`) used for stateless tokens (e.g. password reset / email confirmation links) |
| Passwords | `bcryptjs` |
| CSRF protection | `csrf-sync` (synchronizer token pattern) |
| Input validation | `express-validator` |
| Rate limiting | `express-rate-limit`, tuned per-endpoint |
| Security headers | `helmet`, custom hand-tuned CSP |
| NoSQL-injection protection | `mongo-sanitize` |
| File uploads | `multer` |
| Image processing | `sharp` (resizing/optimizing to WebP) |
| Video processing | `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` |
| Email | `nodemailer` (SMTP) |
| Telegram notifications | `telegraf` |
| PDF generation | `pdfkit` |
| Logging | `pino` (structured logging), `morgan` (HTTP request logging) |
| Testing | Node.js built-in test runner (`node --test`), `supertest` for HTTP integration tests, `mongodb-memory-server` for isolated DB tests |
| Dev tooling | `nodemon` |

No frontend build step, no bundler, no client-side framework — pages are rendered server-side with EJS and progressively enhanced with vanilla JS widgets where needed (admin form builders, schedule editor, repeaters, multiselects). This is a deliberate choice: it keeps the stack simple, fast to develop in solo, and easy to reason about end-to-end.

## 5. Architecture

The codebase follows a **strict layered architecture**, and this separation is enforced by convention throughout — no layer reaches past the one directly below it.

```
Request
  → Route            (URL + HTTP verb + middleware wiring)
  → Middleware        (auth, permissions, validation, rate limiting, CSRF, file upload)
  → Controller         (req/res only — no business logic, no DB access)
  → Service            (business logic, transactions, orchestration)
  → Repository         (the only layer that talks to Mongoose/MongoDB)
  → Model              (Mongoose schemas — data shape + schema-level rules only)
       ↓
  → Mapper             (shapes raw DB documents into plain client-safe objects)
  → Presenter           (assembles view-model data structures for EJS templates)
  → View (EJS)          (pure rendering, no logic beyond loops/conditionals)
```

**Why this separation matters here specifically:**
- **Controllers** never call a repository directly — every controller only talks to a service. This means business rules (like "you can't cancel less than 24h before your appointment") live in exactly one place and can never be bypassed by a different entry point.
- **Repositories** are the only files that import Mongoose models directly. This means switching a query strategy, adding a population constant, or optimizing an index only ever requires touching one file per entity.
- **Presenters** are a distinct layer from mappers: mappers turn a Mongoose document into a safe, minimal, client-facing object (used by both API-style JSON responses and views); presenters go one step further and shape that data specifically for what a given EJS template needs to render (labels, grouped sections, form field definitions for the admin form-builder, etc).
- **Validators** (`express-validator` chains) live entirely in the middleware layer and never leak into services — a service function can be called directly (e.g., from a test, from the Telegram bot, from a background job) without needing HTTP-shaped input.

### Composition root

`src/app.js` builds the Express app by composing small, single-purpose config modules (`helmet.config.js`, `cors.config.js`, `session.config.js`, `csrf.config.js`, etc.) in a specific, deliberate order — for example, body parsing and Mongo-sanitization must run before CSRF and session middleware. `src/server.js` is the actual process entry point: it connects to MongoDB, starts the Telegram bot, starts the HTTP server, and wires up graceful shutdown (SIGTERM/SIGINT handling with a forced-exit timeout, so deploys don't hang).

### Events

A lightweight internal event emitter (`src/events/event.emitter.js`) decouples "a thing happened" from "here's everything that should happen as a result." Services emit domain events (`appointment:created`, `appointment:status_changed`, `user:guest_created`, `package_purchase:created`, etc.) *after* their database transaction commits — never before. Two independent listener modules (`email.listener.js`, `telegram.listener.js`) subscribe to these events and handle notification side-effects, so adding a new notification channel in the future never requires touching business logic.

### Background jobs

`src/jobs/email-retry.job.js` retries failed outbound emails, so a transient SMTP failure doesn't silently drop a booking confirmation.

## 6. Domain Model & Business Logic

### Core entities

- **User** — client account (can be a real registered user, a Google-OAuth user, or a lightweight "guest" account created transparently the first time someone books without registering).
- **Employee** — a therapist account, with weekly working hours (`workingHours: [{ day, slots: [{from, to}] }]`) and the set of services they're qualified to perform.
- **Expert** — public-facing team-member profile (bio, photo, specialties) shown on the "Our Team" page — distinct from `Employee` because not every public-facing expert profile necessarily maps 1:1 to a bookable staff account.
- **Service** — a treatment type (e.g. "Therapeutic Massage"), containing one or more **variants** (`packages[]` on the Service schema — e.g. "30 min" vs "60 min"), each with its own duration and price.
- **Package** — a bundle of pre-paid sessions across one or more service variants, sold at a discount (e.g. "10x Medical Bio-Reset — 20% off").
- **PackagePurchase** — a specific instance of a client having bought a Package: tracks `sessionsTotal`, `sessionsUsed`, and `sessionsReserved` per item.
- **Appointment** — the actual booked time slot: service + variant + employee + time window + status + payment method (full price / coupon / package).
- **Coupon** — discount codes with usage rules and redemption tracking.
- **Role** — a named, fully data-driven set of permissions (not a fixed enum — an admin can create any slug-formatted role and assign any combination of permissions to it).
- **Post / Category / Tag** — the blog and taxonomy system, shared between blog posts and services/packages for cross-cutting organization and filtering.
- **Testimonial** — client reviews, moderated before publication, optionally linked to the reviewer's account and to the specific service/package they're reviewing.
- **Contact**, **NewsLetter** — inbound contact-form messages and newsletter subscribers.

### The booking flow, in detail

Booking an appointment (`appointment.service.js: bookAppointment`) is the most business-critical piece of logic in the system, and it's built to be correct under real concurrency:

1. **Before any transaction starts**, the system resolves the exact service variant being booked, checks whether the requesting client already has an account (by session, or by email lookup for guests), and — if paying via coupon or package — validates that the coupon/package is actually usable *right now* (active, not expired, has remaining sessions, belongs to this user).
2. **Everything that must succeed or fail together happens inside a single MongoDB transaction**: creating a guest account if needed, a final race-guard re-check that the slot is still free (protecting against two people booking the same slot seconds apart based on the same stale availability list), writing the Appointment, and — if paying via package — reserving one session.
3. **Domain events fire only after the transaction commits** — so a client is never notified about a booking that didn't actually succeed.
4. **Payment methods are mutually exclusive by business rule** (enforced in the service layer, not the schema): full price, full price minus a coupon, or fully covered by a package session — never a combination.

### Availability calculation

`availability.service.js` computes free slots for a given service variant and date using real interval arithmetic:
- starts from an employee's working-hour windows for that weekday,
- subtracts every existing appointment as a busy interval, **padded on both sides by a configurable buffer** (`booking.config.js`) so therapists always get a break between clients — not just "no literal overlap,"
- slices what's left into a fixed time grid (e.g. every 30 minutes) so offered start times are always clean and predictable, independent of how long the specific service happens to last,
- when no specific employee is requested, merges free slots across every qualified employee by identical start time, so the client sees "9:00, 9:30, 10:00…" once, not once per therapist.

The same buffer and overlap logic is applied identically at write time (when the booking is actually created) as at read time (when slots are displayed) — so what a client sees as available is what will actually be accepted.

### Appointment status lifecycle

A single source of truth (`appointment-status-transitions.js`) defines every legal status transition and which role is allowed to make it:

```
pending → confirmed / rejected / cancelled
confirmed → completed / no_show / cancelled / rejected
rejected → pending (admin can reopen)
cancelled → pending (admin can reinstate)
no_show → pending (admin can reopen)
completed → (terminal — nothing transitions out)
```

This same table is consumed by the server-side validator (to reject illegal transitions) and by the admin presenter (to render only the action buttons that are actually legal for the current status/role combination) — so the UI and the enforcement can never drift apart.

Package-session bookkeeping is tied directly to this lifecycle: a session is *reserved* the moment a package-paid booking is made, *committed* (moved from reserved to used) only when the appointment is marked `completed`, and *released* back to available if the appointment is cancelled, rejected, or marked as a no-show before ever being delivered.

### Permissions system

Roles are entirely data-driven. `PERMISSIONS` is a fixed catalog of fine-grained capability strings (`manage_services`, `manage_packages`, `manage_appointments_all`, `access_admin_panel`, etc.), but `Role` names themselves are open — an admin can create a role called anything (validated as a lowercase slug) and assign it any subset of permissions. Every admin route section is individually guarded with `requirePermission("...")`, so a role can, for example, manage the blog without being able to touch appointments or user accounts.

## 7. Security

Security was treated as a first-class concern, not an afterthought:

- **CSRF**: synchronizer-token pattern (`csrf-sync`), applied to every state-changing web request, with a correctly-handled exception for multipart file-upload routes (CSRF is re-applied immediately *after* Multer parses the body, on every single admin route that accepts a file upload).
- **Rate limiting**: not one blanket limiter — a dozen independently-tuned limiters (login: 5/15min, registration: 3/hour, password reset: 3/hour, contact form: 1/min, booking: 5/min, admin panel: 300/min, etc.), so an attacker hammering the login form doesn't get the same budget as a normal user browsing services.
- **Session security**: MongoDB-backed sessions (not in-memory — survives restarts and scales horizontally), `httpOnly` + `sameSite: lax` cookies, `secure` cookies enforced in production.
- **Headers**: `helmet` plus a hand-written Content-Security-Policy tuned for the exact third parties actually in use (Google Sign-In, Google Maps embed, Cloudflare) rather than a permissive default; HSTS enforced in production over HTTPS.
- **NoSQL injection**: every request body/query/param is recursively sanitized against Mongo operator injection (`$`, `.` in keys), with an explicit skip-list for fields like email/password where sanitization would corrupt legitimate input.
- **Passwords**: hashed with `bcryptjs`, never stored or logged in plaintext.
- **Access control**: every admin route section is permission-gated individually (see above), and every appointment/user-scoped read checks that the requester actually owns or is authorized to view that specific record (`canAccessAppointment` — admins see everything, employees see only what's assigned to them, clients see only their own).

## 8. Notifications & Integrations

- **Email** (`nodemailer` + SMTP): transactional emails for account confirmation, password reset, appointment created/confirmed/cancelled/reassigned, package purchase created/cancelled, newsletter welcome/campaign — all built from a shared EJS layout so branding stays consistent, and driven off the same domain events as the rest of the system (not called ad-hoc from controllers).
- **Telegram** (`telegraf`): a bot posts internal operational notifications (new appointment, new contact message, new testimonial awaiting moderation) into designated chat threads, so the studio team gets a real-time heads-up without needing to log into the admin panel.
- **Google OAuth**: optional sign-in/sign-up via Google, alongside standard email/password registration.
- **Failed-email retry job**: a background job retries transactional emails that failed to send, so a temporary SMTP outage doesn't silently swallow a booking confirmation.

## 9. SEO

Every public page type — homepage, service, package, blog post, category, tag, expert profile, static pages — is built with a dedicated SEO "builder" (`src/seo/builders/`) producing consistent `<title>`, meta description, canonical URL, and Open Graph tags, plus a sitemap service (`sitemap.service.js`). This matters a lot for a local business that depends on organic search for new client discovery — every one of the studio's ~10+ individual treatments and packages is independently indexable and shareable.

## 10. Testing

The project has a genuinely comprehensive automated test suite, split into two kinds:

- **Unit tests** — services, validators, and utilities tested in isolation.
- **Integration tests** — real HTTP requests against the full Express app (via `supertest`) against an isolated in-memory MongoDB instance (`mongodb-memory-server`), covering full request/response cycles including CSRF behavior, plus direct repository-level tests against the same in-memory database.

**Latest full test run:**

```
tests 798
suites 322
pass 798
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 28216.271317
```

**798 tests across 322 suites, 100% passing, in ~28.2 seconds.** Coverage spans every business-critical path: the booking transaction and its race conditions, the package-session reserve/commit/release lifecycle, coupon redemption, the full appointment status state machine, every validator, every repository query, and full HTTP-level regression tests for CSRF handling specifically (`csrf-regression.http.test.js`) — meaning security-relevant behavior isn't just implemented, it's continuously verified.

### Coverage breakdown

The built-in Node.js test-runner coverage report shows an overall **72.62% line / 68.22% branch / 69.10% function** coverage, but the aggregate number hides where coverage actually matters. Broken down by layer:

| Layer | Typical coverage | Notes |
|---|---|---|
| **Validators** | ~95–100% line | Nearly every validator (`appointment`, `booking`, `category`, `contact`, `coupon`, `employee`, `expert`, `media`, `newsletter`, `package-purchase`, `role`, `search`, `spam`, `tag`, `testimonial`, `user`) sits at 100% line coverage — every input-validation rule is exercised. |
| **Models** | ~100% line | Every Mongoose schema, including all shared sub-schemas (`image`, `video`, `faq`, `phone`, `service-feature`, `service-package`, `comparison-row`), fully covered. |
| **Routes** | 100% line across the board | Every route file, admin and public, fully covered — route wiring and middleware order are exercised end-to-end by the HTTP integration suite. |
| **Repositories** | ~85–100% line | The data-access layer — the only layer allowed to talk to Mongoose — is very thoroughly tested; a few filter helpers sit lower (70–90%) on less-common filter-combination branches. |
| **Services** | ~75–98% line | The business-logic layer is consistently well covered — `availability.service.js` (97.9%), `appointment.service.js` (90.2%), `package-purchase.service.js` (94.2%), `coupon.service.js` (95.7%), `service.service.js` (97.8%) are all high, reflecting the deliberate focus on getting the booking/package/coupon logic right. `sitemap.service.js` (37.5%) is the one clear outlier — it's exercised far less than the rest. |
| **Config** | ~55–100% line | Most config modules (booking, cors, csrf, flash, sanitize, session, view-engine) are at or near 100%; `logger.config.js` and `morgan.config.js` are lower, since a lot of their code is log-formatting/transport branches that only run under specific runtime conditions rather than typical request flows. |
| **Controllers / Presenters** | ~15–75% line | Consistently the lowest numbers in the report, and expected to be — controllers are intentionally thin (req/res plumbing that calls a service), and much of their logic is already exercised indirectly through the HTTP integration suite rather than in isolated unit tests; several admin presenters (dashboard, media-form, profile, package-purchase) show very low isolated coverage because they're simple view-model assemblers whose correctness is really validated by rendering, not by unit-testing every branch. |
| **SEO builders** | ~9–23% line | The least-covered area in the codebase — the individual per-page-type SEO builders (`category`, `expert`, `page`, `post`, `service`, `tag`) are largely untested in isolation, though `seo/index.js` itself (the shared entry point) is at 95%. This is a known, low-risk gap since builders are pure, simple string-formatting functions. |

**Reading this honestly:** the parts of the system where a bug would actually cost money or create a data-integrity problem — the booking transaction, the package-session lifecycle, coupon redemption, permission checks, validators, and the data-access layer — are covered at 85–100%. The lower numbers cluster almost entirely in "thin" layers (controllers, presenters, SEO builders) where the risk of an untested branch is a cosmetic or SEO issue, not a business-logic one.

## 11. Project Structure

The full repository layout (uploaded media under `public/images` and `public/videos` omitted for brevity — those are user-uploaded content, not part of the codebase):

```
.
├── logs                                    # Runtime logs (pino/morgan output — see §14 for planned log-management work)
│   ├── app-dev.log
│   ├── error-dev.log
│   └── http-dev.log
├── package.json
├── package-lock.json
├── src
│   ├── app.js                              # Express app composition (middleware order)
│   ├── server.js                           # Process entry point (DB connect, listen, graceful shutdown)
│   ├── config                              # One file per cross-cutting concern
│   │   ├── booking.config.js, cors.config.js, csrf.config.js, flash.config.js
│   │   ├── helmet.config.js, locals.config.js, logger.config.js
│   │   ├── method-override.config.js, morgan.config.js, multer.config.js
│   │   ├── sanitize.config.js, session.config.js, static.config.js, view-engine.config.js
│   ├── controllers/web                     # Thin req/res handlers, mirroring the domain
│   │   ├── admin/{appointment, auth/{employee,expert,role,user}, blog/post,
│   │   │         catalog/{package,package-purchase,service}, dashboard,
│   │   │         marketing/{contact,coupon,news-letter,testimonial},
│   │   │         profile, taxonomy/{category,tag}}.controller.js
│   │   ├── auth/auth.controller.js, blog/blog.controller.js
│   │   ├── catalog/{package,service}.controller.js, employee/employee.controller.js
│   │   ├── index.controller.js, public/{booking,expert}.controller.js
│   │   └── seo.controller.js, user/user.controller.js
│   ├── database/seeds                      # Seed scripts (roles, initial ESMA catalog)
│   │   ├── esma-catalog.seed.js, roles.seed.js
│   │   └── run-esma-seed.js, run-roles-seed.js
│   ├── events
│   │   ├── event.emitter.js
│   │   └── listeners/{email,email-fail,telegram}.listener.js, index.js
│   ├── integrations
│   │   ├── email/email.provider.js
│   │   └── telegram/{telegram.config,telegram.provider}.js
│   ├── jobs
│   │   └── email-retry.job.js
│   ├── mappers                              # DB document → client-safe object shaping (one per entity)
│   │   ├── appointment.mapper.js  ├── category.mapper.js     ├── contact.mapper.js
│   │   ├── coupon.mapper.js       ├── employee.mapper.js     ├── expert.mapper.js
│   │   ├── news-letter.mapper.js  ├── package.mapper.js      ├── package-purchase.mapper.js
│   │   ├── post.mapper.js         ├── role.mapper.js         ├── service.mapper.js
│   │   ├── tag.mapper.js          ├── testimonial.mapper.js  └── user.mapper.js
│   ├── middlewares
│   │   ├── admin.middleware.js, auth.middleware.js, employee.middleware.js
│   │   ├── error.middleware.js, parse-json-fields.middleware.js
│   │   ├── permission.middleware.js, rate-limiter.middleware.js
│   │   ├── sanitize-array-fields.middleware.js
│   │   └── validators/                      # One validator chain file per entity + helpers/
│   ├── models
│   │   ├── appointment.model.js, appointment-status-transitions.js
│   │   ├── category.model.js, contact.model.js, coupon.model.js
│   │   ├── employee.model.js, expert.model.js, news-letter.model.js
│   │   ├── package.model.js, package-purchase.model.js, post.model.js
│   │   ├── role.model.js, service.model.js, tag.model.js
│   │   ├── testimonial.model.js, user.model.js
│   │   └── schemas/                         # Shared sub-schemas: image, video, faq, phone, service-feature, service-package, comparison-row
│   ├── presenters                           # View-model assembly, mirrors controllers/ structure
│   │   ├── admin/{appointment,auth,blog,catalog,marketing,taxonomy}/...
│   │   ├── admin/{dashboard,media-form,profile}.presenter.js
│   │   ├── auth/auth.presenter.js, blog/blog.presenter.js
│   │   ├── catalog/{package,service}.presenter.js, employee/employee.presenter.js
│   │   ├── public/{booking,expert,index}.presenter.js
│   │   └── user/user.presenter.js
│   ├── public                               # Client-side static assets
│   │   ├── css/{styles,variables}.css
│   │   ├── favicon.ico, icons/, site.webmanifest
│   │   ├── images/{categories,experts,packages,posts,services,site,testimonials}/  (uploaded media — omitted)
│   │   ├── js/{admin-comparison-table,admin-content-blocks,admin-multiselect,admin-repeater,admin-schedule,admin-select-preview,main}.js
│   │   ├── json/, pdf/
│   │   └── videos/{category,our-service,package,post,site,thumbnails}/  (uploaded media — omitted)
│   ├── repositories                         # The only layer touching Mongoose directly
│   │   ├── appointment.repository.js  ├── category.repository.js  ├── contact.repository.js
│   │   ├── coupon.repository.js       ├── employee.repository.js  ├── expert.repository.js
│   │   ├── news-letter.repository.js  ├── package.repository.js   ├── package-purchase.repository.js
│   │   ├── post.repository.js         ├── role.repository.js      ├── service.repository.js
│   │   ├── tag.repository.js          ├── testimonial.repository.js ├── user.repository.js
│   │   └── filters/                         # One filter-builder file per entity
│   ├── routes
│   │   ├── index.routes.js
│   │   └── web/
│   │       ├── admin.routes.js
│   │       ├── admin/                       # One route file per admin section (16 files)
│   │       ├── auth.routes.js, blog.routes.js, booking.routes.js
│   │       ├── employee.routes.js, package.routes.js, service.routes.js
│   │       └── team.routes.js, user.routes.js, web.routes.js
│   ├── seo
│   │   ├── builders/{category,expert,page,post,service,tag}.builder.js
│   │   ├── index.js, utils.seo.js
│   ├── services                             # All business logic and orchestration
│   │   ├── appointment.service.js  ├── auth.service.js       ├── availability.service.js
│   │   ├── blog.service.js         ├── category.service.js   ├── contact.service.js
│   │   ├── coupon.service.js       ├── crypto.service.js     ├── email.service.js
│   │   ├── employee.service.js     ├── expert.service.js     ├── index.service.js
│   │   ├── news-letter.service.js  ├── package.service.js    ├── package-purchase.service.js
│   │   ├── post.service.js         ├── role.service.js       ├── service.service.js
│   │   ├── sitemap.service.js      ├── tag.service.js        ├── telegram.service.js
│   │   ├── testimonial.service.js  └── user.service.js
│   ├── utils
│   │   ├── date.time.util.js, encrypted-field.util.js, error.util.js
│   │   ├── flash.util.js, form-bool.util.js, logger.util.js
│   │   ├── media-form.util.js, pagination.util.js, phone.util.js
│   │   └── slug.util.js, telegram-message.util.js
│   └── views                                # EJS templates
│       ├── admin/{components/, dashboard.ejs, _details.ejs, _form.ejs, _list.ejs, _media-form.ejs, post/seo.ejs, services/seo.ejs}
│       ├── auth/_auth-form.ejs
│       ├── blog/{blog,post-details}.ejs
│       ├── booking/{confirmation,contact-step,service-step,slots-step}.ejs
│       ├── emails/                          # 17 transactional email templates + _layout.ejs
│       ├── employee/{appointment-details,appointments,dashboard,profile}.ejs
│       ├── error/error.ejs
│       ├── includes/{breadcrumbs,flash-messages,footer,head,navigation,pagination}.ejs + components/
│       ├── landing/{expert-details,home,team}.ejs
│       ├── public/_page.ejs
│       ├── services/{package-details,packages,service-details,services}.ejs
│       └── user/{appointment-details,_appointment-tab,profile,_settings-tab}.ejs
└── test
    ├── helpers/{csrf,factories,pagination,session,upload,validator-harness}.js
    ├── integration
    │   ├── http/                            # 23 full HTTP flow test files (admin + public + auth + booking + CSRF regression)
    │   ├── repositories/                    # 14 repository-level test files (one per entity)
    │   └── setup/{db-handler,test-app}.js
    └── unit
        ├── services/                        # 20 service test files
        ├── utils/form-bool.util.test.js
        └── validators/                       # 17 validator test files

105 directories, 470 files
```

## 12. Environment Variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | HTTP port |
| `MONGO_URI` | MongoDB connection string |
| `SESSION_SECRET` | Session cookie signing secret |
| `JWT_SECRET` | Signing secret for stateless tokens (e.g. password reset links) |
| `AES_SECRET` | Encryption key for encrypted fields |
| `SITE_NAME` | Brand name used in emails/SEO fallback |
| `BASE_URL` | Public base URL, used in emails and canonical links |
| `ADMIN_EMAIL`, `SUPPORT_EMAIL` | Internal/notification addresses |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | Outbound email sender identity |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | SMTP transport config |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth login |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram bot credentials |
| `TELEGRAM_APPOINTMENTS_THREAD`, `TELEGRAM_CONTACTS_THREAD`, `TELEGRAM_TESTIMONIALS_THREAD`, `TELEGRAM_USERS_THREAD`, `TELEGRAM_ERRORS_THREAD` | Per-topic Telegram chat threads |
| `UPLOAD_PUBLIC_PATH` | Public path prefix for uploaded media |
| `LOG_LEVEL` | Pino log verbosity |

## 13. Running the Project

```bash
# Install dependencies
npm install

# Development (auto-restart on change)
npm run start-dev

# Production
npm start

# Run the full test suite
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

Seed scripts are available under `src/database/seeds/` to bootstrap roles and an initial service/package catalog on a fresh database.

## 14. Design Philosophy & Lessons Learned

A few principles were deliberately followed throughout, and are worth stating explicitly because they explain *why* the code looks the way it does:

- **The controller layer is intentionally "boring."** If a controller does anything beyond validating that a request happened and calling a service, that logic is in the wrong place.
- **One source of truth per rule.** Status transitions, permissions, and booking buffers each live in exactly one config/constant file, consumed everywhere they're needed — never re-declared.
- **Populate consistency matters.** Every Mongoose reference field has one shared populate constant per entity, applied uniformly across every read path — a missing `.populate()` on just one query is a classic source of "why is this field empty here but not there" bugs, and this codebase avoids that by never letting populate lists drift per-query.
- **Test fixtures derive from the same source as production code**, not from separately-maintained seed data — e.g., test helpers compute admin permissions directly from the `PERMISSIONS` catalog in the Role model, so a new permission added to production code is automatically reflected in tests, instead of silently going untested.
- **Events, not direct calls, for side effects.** Notification logic (email, Telegram) is entirely decoupled from business logic via the event emitter, so business services stay focused on business rules.

## 15. Roadmap

- ~~Employee-facing schedule editor~~ — **done.** `workingHours` used to require raw JSON input; it's now a proper visual day-by-day editor (add/remove time-range rows per weekday, native time pickers, "Neradni dan" shown for days with no slots) built once as a shared widget (`admin-schedule.js`) and used in **both** places that need it: the admin's employee-management form (`PUT /admin/zaposleni/:employeeId/radno-vreme`) and the employee's own self-service profile page (`POST /moj-nalog/profil/radno-vreme`). Same component, same validation (`validateWorkingHoursUpdate`), same underlying `employeeService.manageWorkingHours()` call — an admin editing a therapist's hours and a therapist editing their own hours go through identical, single-source logic.
- Continued expansion of the admin form/wizard system as new content types are added.
- Populating the public Team page and Blog with real content now that the underlying CMS is complete.
- **Log analytics & log lifecycle management (planned).** The app currently writes structured logs (`pino`) and HTTP access logs (`morgan`) straight to disk under `logs/` (`app-dev.log`, `error-dev.log`, `http-dev.log`), with no rotation, archiving, or reporting on top of them yet. Planned work:
  - A periodic (e.g. daily/weekly) job that parses the accumulated logs and generates a **PDF summary report** — error rates, slow requests, notable warnings — and emails it automatically, so issues surface proactively instead of requiring someone to manually read raw log files.
  - **Log rotation**, so log files don't grow unbounded on disk (size- and/or time-based rotation, e.g. via `pino`'s rotating transport or a dedicated rotation tool).
  - A retention/archiving strategy for rotated logs — likely compressing and moving them to cold storage (e.g. cloud object storage) after a set period — so historical logs remain available for auditing without permanently consuming production disk space.
  - This closes a real current gap: right now, diagnosing a production issue means SSHing in and grepping raw log files by hand, with no automatic cleanup, no automatic summarization, and no long-term retention plan.

---

*This document describes the system as of the current `main` branch. For a plain-language walkthrough in Serbian, see `README.sr.md`.*
