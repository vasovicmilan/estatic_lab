# Testing

The platform has three separate layers of tests, each checking the system in a different way with a different tool. This file explains what each layer does, what it currently covers, how to run it, and a handful of patterns/gotchas worth knowing before writing new tests.

## The three layers

**Unit tests** check individual service functions in isolation — every call to the database and to other services is mocked. The fastest layer, the largest number of tests, the first line of defense for business logic (commission math, coupon validation, status transitions).

**Integration tests** run a real Express app in memory (`supertest`, no real HTTP socket) against a real in-memory MongoDB instance (`mongodb-memory-server`). They check that the controller, validator, service, and repository work correctly together for a given HTTP request — without launching a real browser.

**E2E (end-to-end) tests** use Playwright to drive a real headless Chromium browser against a real Express server (again backed by `mongodb-memory-server`, but as a real HTTP server on a port this time, not in-process). This is the only layer that actually clicks through forms, follows redirects, and sees exactly what a real visitor would — including things that only happen in the browser (hidden fields, JS widgets, session cookies).

All three layers exist because they check different things: a unit test that commission math produces the right number, an integration test that an HTTP request with bad data returns the right status code, an E2E test that a customer can actually complete a purchase from start to finish through the real form.

## Running them

```bash
npm test                  # unit + integration tests
npm run test:coverage     # same, plus a code coverage report
npm run test:watch        # same, re-runs on file change

npx playwright test       # E2E tests
npx playwright test --list   # just lists which tests exist, doesn't run them
```

`npm test` and `npx playwright test` are deliberately separate commands, run separately — Node's built-in test runner (`node --test`) and Playwright's own test runner are two different tools that can't share the same process. `package.json`'s `test`/`test:coverage` scripts explicitly target only the `test/unit/**` and `test/integration/**` paths so Node's runner doesn't accidentally try to execute the Playwright specs (Node's `--test` recursively scans everything under `test/` by default).

**An important note about the coverage report**: `npm run test:coverage`'s percentage only counts code executed inside the unit/integration test process. E2E tests run the server as a completely separate process (so a real browser can reach it over the network), so that code never passes through Node's coverage measurement — even though the E2E tests genuinely exercise it. A controller with a low reported coverage percentage (e.g. `partner.controller.js`) may actually be well covered via E2E, the tool just can't see it because that code ran in a different process.

## What's covered

### Unit tests
Over 1700 tests under `test/unit/`, organized by service/mapper/repository/validator. The most financially sensitive services — `commission.service.js`, `payout-request.service.js`, `resource.service.js` — are at 100% line and function coverage.

### E2E tests
23 tests under `test/e2e/`, by business flow:

| File | What it checks |
|---|---|
| `checkout-freight-shipping.spec.js` | An order with a large/heavy item doesn't get an automatic shipping price; an admin enters it manually; only then can the customer confirm |
| `coupon-product-discount.spec.js` | A coupon's separate product-side discount (independent of the services discount), including the amount cap and the partner's commission at the products rate |
| `booking-appointment-commission.spec.js` | Booking an appointment end to end, and the employee's + partner's commission at the services rate once an admin completes the appointment |
| `employee-appointment-management.spec.js` | An employee manages their own assigned appointments through their own panel; can't see/act on someone else's |
| `customer-self-service.spec.js` | A customer views and cancels their own appointments/orders, respecting the 24h appointment-cancellation cutoff and the "pending only" rule for orders |
| `employee-working-hours.spec.js` | Changing an employee's working hours through their own panel actually changes which appointment slots are offered |
| `package-purchase.spec.js` | An admin assigns a package to a customer; the customer spends a session through booking; the session moves from reserved to used only once an admin completes the appointment |
| `appointment-reassign.spec.js` | An admin reassigns an appointment to a different employee; the dropdown already excludes employees who aren't available at that time |
| `order-completion-commission.spec.js` | An order's commission stays "pending" through processing/shipped/delivered, and only becomes "earned" once the order is marked completed |
| `order-cancellation.spec.js` | Cancelling or returning an order restores the reserved quantities to stock |
| `payout-cycle.spec.js` | The full payout cycle (request → approve → paid, and rejection) for an employee and for a partner separately |

## E2E layer architecture

`playwright.config.js` starts `test/e2e/setup/start-server.js` as a separate process before the tests run (Playwright's `webServer` mechanism) — that file spins up `mongodb-memory-server`, seeds the base roles, and starts a real Express server on port 4100. Since the spec files themselves run in a **separate** Node process from that server, `test/e2e/helpers/db.js` opens its own connection to the **same** in-memory database (reading the connection string from a temp file `start-server.js` writes) — this lets specs seed data directly (a product, a coupon, an employee) and check results in the database, rather than relying solely on what's visible on screen.

`test/e2e/helpers/e2e-helpers.js` holds all the shared data-seeding functions (`seedProduct`, `seedService`, `seedEmployee`, `seedPartner`, `seedCoupon`, `seedOrder`, `seedAppointment`, `seedPackage`, `seedCommissionEntry`...) and the common UI actions (`registerAndLoginViaUI`, `loginViaUI`, `promoteToAdmin`, `confirmActionModal`, `setEmployeeWorkingHoursViaUI`).

## Patterns and gotchas worth remembering

A few things that weren't obvious until they were hit for the first time — worth knowing before writing new E2E specs:

- **A new tab (`context.newPage()`) shares cookies with an existing page** within the same `BrowserContext`. For a "second actor" (e.g. an admin while the customer is already logged in), use a real new `browser.newContext()` instead — otherwise the login page immediately redirects to the homepage because a session already exists.
- **Three different confirmation patterns** exist in the admin interface: a plain form with no confirmation, `data-confirm` which opens a shared Bootstrap modal (`#confirmActionModal`/`#confirmActionButton` — clicking the button only opens the modal, `confirmActionModal()` is what actually confirms it), and a `needsReason` form which is a real form with a reason field inside its own modal (no `#confirmActionButton`, has its own "Confirm" button inside `.modal.show`).
- **The working-hours widget** (`admin-schedule.js`) has its own `submit` listener that re-writes the hidden field right before the form submits — setting that field's value directly gets silently overwritten. You have to actually click through the widget's controls (the `setEmployeeWorkingHoursViaUI()` helper does this correctly).
- **The appointment-reassignment dropdown already excludes unavailable employees** server-side — there's no "pick one, then get an error" flow; the option simply isn't offered.
- **An order's commission doesn't become "earned" automatically** when the order is confirmed — only once an admin marks the order fully completed (the `order:status_changed` event, only for the `completed` status). Reversing commission when an order is cancelled goes through a separate scheduled job (`processGracePeriodCommissions`), not an event — there's no direct UI trigger for that.
- **Event listeners have to be explicitly loaded** in `start-server.js` (the same pattern the real `server.js` uses) — `app.js` alone doesn't register them. Without this, anything that depends on an event (recording commission, etc.) would silently never run, with no error anywhere.
- **CSS classes can't always be used as a selector** — e.g. `.btn-outline-primary` also matches the "Register" button in the navigation. A `href` pattern, `role`, or `data-*` attribute is more reliable where available.
- **Responsive views duplicate content** (a mobile list + a desktop table, one hidden via CSS) — a generic `getByText()` selector can hit the hidden duplicate. `getByRole("cell", ...)` is more reliable for tabular data.