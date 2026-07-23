import auditLogService from "../../../../services/audit-log.service.js";
import { prepareAuditLogListData } from "../../../../presenters/admin/logs/audit-log.presenter.js";
import { logError } from "../../../../utils/logger.util.js";

export async function auditLogList(req, res, next) {
  try {
    const { page = 1, limit = 25, action, success, actorId, entityType, entityId } = req.query;

    const [result, availableActions] = await Promise.all([
      auditLogService.listAuditLogs({
        filters: {
          action: action || undefined,
          success: success === "" || success === undefined ? undefined : success === "true",
          actorId: actorId || undefined,
          entityType: entityType || undefined,
          entityId: entityId || undefined,
        },
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 25,
      }),
      auditLogService.listDistinctActions(),
    ]);

    const viewData = prepareAuditLogListData(result, req.query, availableActions);

    return res.render("admin/logs/audit", {
      pageTitle: "Audit log",
      pageDescription: "Istorija administrativnih akcija",
      data: viewData,
    });
  } catch (error) {
    logError("[auditLogList] Greška pri učitavanju audit loga", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export default { auditLogList };