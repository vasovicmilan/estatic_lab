// Every admin write action calls auditLogService.recordAuditLog({ ...buildAuditActor(req), action, entity, changes? }).
// The "who did this, from what request, did it succeed" part of that call
// (actor/req/success) never varies by entity type - only action/entity/changes
// do - so it was being redefined as an identical local `auditActor(req)`
// helper in most api/v1 admin controllers, and inlined outright (same three
// fields, no name) in the rest. Centralized here so every controller shares
// one definition of "what recordAuditLog needs to know about the request".
//
// A handful of catch blocks (rejected testimonial approval, a cancelled package
// purchase that failed partway) log a FAILED action instead - same actor/req
// pair, `success: false` plus an `errorMessage`. `overrides` covers that case
// without splitting into a second helper: `buildAuditActor(req, { success:
// false, errorMessage: error.message })`.
export function buildAuditActor(req, overrides = {}) {
  return { actor: req.user, req, success: true, ...overrides };
}

// Cron/system jobs (src/jobs/*) have no `req` at all - there's no HTTP request
// to pull ip/userAgent/requestId from, and no logged-in user to be the actor.
// recordAuditLog's `actor` shape still expects { id, email, role }, so this
// gives every system-triggered write a recognizable, consistent actor
// (role: "system", id/email null) instead of each job improvising its own
// shape or faking a `req` object just to reuse buildAuditActor. No `req` is
// passed through, so ip/userAgent/requestId simply stay null on these entries -
// there's genuinely no request they could be correlated to.
export function buildSystemActor(overrides = {}) {
  return { actor: { id: null, email: null, role: "system" }, success: true, ...overrides };
}

export default { buildAuditActor, buildSystemActor };
