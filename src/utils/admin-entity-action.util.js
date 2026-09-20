import auditLogService from "../services/audit-log.service.js";
import { logError, logInfo } from "./logger.util.js";
import { buildAuditActor } from "./audit-actor.util.js";

/**
 * Builds the `actionName(auditAction, serviceCallFn, successMessage) => handler`
 * factory that admin-appointment.controller.js, admin-order.controller.js and
 * employee.controller.js each hand-rolled separately (as `appointmentAction`/
 * `orderAction`) to turn a one-line service call (confirm/reject/cancel/...)
 * into a full Express handler: pull the id from req.params, call the service,
 * log it, write an audit-log entry, respond with a success message.
 *
 * `resolveContext(req)` is the one real difference between those three call
 * sites: admin-appointment/admin-order don't need anything beyond `req`
 * itself (the default), while employee.controller.js first has to resolve
 * the calling user's OWN employee id before it can call the service. Whatever
 * `resolveContext` returns is passed as `serviceCallFn`'s second argument
 * (with `req` always passed as the third), so:
 *   - admin-appointment/admin-order: `serviceCallFn(id, req)` (context IS req)
 *   - employee: `serviceCallFn(id, employeeId, req)`
 * both keep working unchanged against their existing serviceCallFn lambdas.
 */
export function createEntityActionFactory({ logPrefix, entityType, entityLabel, idParam, resolveContext = async (req) => req }) {
  return function entityAction(actionName, auditAction, serviceCallFn, successMessage) {
    return async function (req, res, next) {
      const entityId = req.params[idParam];
      try {
        const context = await resolveContext(req);
        await serviceCallFn(entityId, context, req);
        logInfo(`[${logPrefix}/${actionName}] ${entityLabel} #${entityId}`, { [idParam]: entityId, actorId: req.user.id });
        await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: auditAction, entity: { type: entityType, id: entityId } });
        return res.json({ success: true, data: { message: successMessage } });
      } catch (error) {
        logError(`[${logPrefix}/${actionName}] Greška`, error, { [idParam]: entityId });
        next(error);
      }
    };
  };
}

export default { createEntityActionFactory };
