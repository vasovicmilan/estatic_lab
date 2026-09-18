import eventEmitter from "../event.emitter.js";
import { logInfo, logError, maskSensitive } from "../../utils/logger.util.js";

// Every other listener in this folder (email/telegram/commission/google-
// calendar) subscribes to a handful of events to trigger a side effect. This
// one is different on purpose: it subscribes to ALL of them, does nothing
// but log, and its only job is to give business analytics ("how many orders
// today", "coupon redemption rate", "booking cancellation rate"...) a clean,
// structured source that doesn't depend on parsing morgan-formatted access-
// log strings out of http.log (see the 2026-09-17 log review - that's
// exactly what was happening before). Every line here has a consistent
// shape - { event: "<name>", ...payload } - so a downstream consumer (log
// shipper, grep, a future analytics query) can filter on `event` alone
// instead of reverse-engineering HTTP status/path patterns.
//
// Adding a new business event: emit it via eventEmitter (see event.emitter.js)
// from wherever it happens, same as every existing one, then add its name to
// BUSINESS_EVENTS below. Nothing else here needs to change - the same
// generic handler logs it.
const BUSINESS_EVENTS = [
  "user:registered",
  "user:confirmed",
  "user:deactivated",
  "order:confirmed",
  "order:status_changed",
  "appointment:created",
  "appointment:status_changed",
  "appointment:reassigned",
  "appointment:rescheduled",
  "appointment:deleted",
  "payout:status_changed",
  "package_purchase:created",
  "package_purchase:cancelled",
  "package_session:consumed",
  "coupon:applied",
  "testimonial:submitted",
  "product:low_stock",
  "product:out_of_stock",
  "newsletter:subscribed",
  "contact:created",
  "temporary-order:pending-quote",
  "temporary-order:created",
  "temporary-order:shipping-quoted",
];

function safe(eventName, handler) {
  return (payload) => {
    try {
      handler(payload);
    } catch (error) {
      logError(`[analytics listener] Failed handling "${eventName}"`, error, { payload });
    }
  };
}

for (const eventName of BUSINESS_EVENTS) {
  eventEmitter.on(
    eventName,
    safe(eventName, (payload) => {
      // maskSensitive: several of these payloads carry more than the event
      // name suggests - user:registered's payload includes a raw
      // confirmToken (email verification link), for instance. Same masking
      // rules as everywhere else in the app (see logger.util.js's
      // SENSITIVE_KEYS) rather than trusting every current and future event
      // emitter call site to never attach a token/secret field.
      logInfo(`[business-event] ${eventName}`, { event: eventName, ...maskSensitive(payload) });
    })
  );
}
