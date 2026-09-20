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

export default { buildAuditActor };
