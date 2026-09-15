import auditLogService from "../../../../services/audit-log.service.js";
import { prepareAuditLogListData } from "../../../../presenters/admin/logs/audit-log.presenter.js";
import { logError } from "../../../../utils/logger.util.js";
// dateFrom/dateTo arrive as plain "YYYY-MM-DD" <input type="date"> strings with
// no timezone info - `new Date("2026-09-14")` parses a date-only string as UTC
// midnight, not Belgrade midnight. On this VPS (system time UTC), filtering
// "do 14.09" with a plain `new Date(dateTo)` $lte cutoff at UTC midnight would
// silently exclude the last ~2h of the 14th (CEST) that the admin clearly meant
// to include. getStartOfDayInZone/getEndOfDayInZone give the real Belgrade day
// boundaries instead - see date.time.util.js.
import { getStartOfDayInZone, getEndOfDayInZone } from "../../../../utils/date.time.util.js";

export async function auditLogList(req, res, next) {
  try {
    const { page = 1, limit = 25, action, success, actorId, actorRole, entityType, entityId, search, dateFrom, dateTo, sortOrder } = req.query;

    const [result, availableActions] = await Promise.all([
      auditLogService.listAuditLogs({
        filters: {
          action: action || undefined,
          success: success === "" || success === undefined ? undefined : success === "true",
          actorId: actorId || undefined,
          actorRole: actorRole || undefined,
          entityType: entityType || undefined,
          entityId: entityId || undefined,
          search: search || undefined,
          dateFrom: dateFrom ? getStartOfDayInZone(dateFrom) : undefined,
          dateTo: dateTo ? getEndOfDayInZone(dateTo) : undefined,
          sortOrder: sortOrder === "asc" ? "asc" : "desc",
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