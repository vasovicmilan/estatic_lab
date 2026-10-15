import userActivityLogService from "../../../../services/user-activity-log.service.js";
import userHistoryService from "../../../../services/user-history.service.js";
import * as userService from "../../../../services/user.service.js";
import { prepareActivityListData, prepareUserHistoryData } from "../../../../presenters/admin/logs/user-activity.presenter.js";
import { resolveAdminLimit } from "../../../../utils/pagination.util.js";
import { getStartOfDayInZone, getEndOfDayInZone } from "../../../../utils/date.time.util.js";
import { logError } from "../../../../utils/logger.util.js";

// GET /admin/logovi/aktivnost - what visitors and customers did, plus the interest summary
export async function activityList(req, res, next) {
  try {
    const { page = 1, limit = 25, action, role, success, userId, search, dateFrom, dateTo, sortOrder } = req.query;

    const [result, actions, summary] = await Promise.all([
      userActivityLogService.listActivities({
        filters: {
          action: action || undefined,
          role: role || undefined,
          success: success === "" || success === undefined ? undefined : success === "true",
          userId: userId || undefined,
          search: search || undefined,
          dateFrom: dateFrom ? getStartOfDayInZone(dateFrom) : undefined,
          dateTo: dateTo ? getEndOfDayInZone(dateTo) : undefined,
          sortOrder: sortOrder === "asc" ? "asc" : "desc",
        },
        page: parseInt(page, 10) || 1,
        limit: resolveAdminLimit(limit, 25),
      }),
      userActivityLogService.listActionOptions(),
      userHistoryService.getInterestSummary({ days: 30 }),
    ]);

    return res.render("admin/logs/activity", {
      pageTitle: "Aktivnost korisnika",
      pageDescription: "Šta posetioci i kupci rade na sajtu",
      data: prepareActivityListData(result, req.query, actions, summary),
    });
  } catch (error) {
    logError("[activityList] Greška pri učitavanju aktivnosti", error, { ...req.query, adminId: req.session?.user?.id });
    next(error);
  }
}

// GET /admin/korisnici/:userId/istorija - audit + activity for one user, merged
export async function userHistory(req, res, next) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 25 } = req.query;
    const user = await userService.getUserById(userId);
    const result = await userHistoryService.getAdminUserHistory(userId, { page: parseInt(page, 10) || 1, limit: resolveAdminLimit(limit, 25) });

    return res.render("admin/logs/user-history", {
      pageTitle: `Istorija - ${user.imePrezime}`,
      pageDescription: user.email,
      data: prepareUserHistoryData(user, result, userId, req.query),
    });
  } catch (error) {
    logError("[userHistory] Greška pri učitavanju istorije korisnika", error, { userId: req.params.userId, adminId: req.session?.user?.id });
    next(error);
  }
}

export default { activityList, userHistory };
