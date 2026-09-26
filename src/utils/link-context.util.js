import { AsyncLocalStorage } from "node:async_hooks";

// Request-scoped "where did this action come from" marker, read by link.builder.js.
//
// Emails and alerts are produced deep inside services (email.service.js, telegram
// listener, ...) that know nothing about the HTTP request that triggered them. Threading
// an `origin` argument through every service call would touch hundreds of signatures, so
// the origin is carried implicitly instead: link-context.middleware.js runs the rest of the
// request inside storage.run({ target }), and everything that request causes - including
// event listeners and promises it starts - sees the same store. Code that runs outside any
// request (cron jobs) simply gets no store and falls back to the deployment default.
const storage = new AsyncLocalStorage();

export function runWithLinkContext(context, fn) {
  return storage.run(context, fn);
}

export function getLinkContext() {
  return storage.getStore() || null;
}
