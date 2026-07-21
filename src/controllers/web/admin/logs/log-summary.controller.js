import logReportService from "../../../../services/log-report.service.js";
import {
  prepareLogDashboardData,
  prepareLogHistoryListData,
  prepareLogSummaryDetailData,
} from "../../../../presenters/admin/logs/log-summary.presenter.js";
import { logError } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function logDashboard(req, res, next) {
  try {
    const todaySummary = await logReportService.getTodaySummary();
    const viewData = prepareLogDashboardData(todaySummary);

    return res.render("admin/logs/dashboard", {
      pageTitle: "Logovi",
      pageDescription: "Pregled saobraćaja i grešaka za danas",
      data: viewData,
    });
  } catch (error) {
    logError("[logDashboard] Greška pri učitavanju pregleda logova", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function logHistoryList(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await logReportService.listLogSummaries({ page: parseInt(page, 10) || 1, limit: parseInt(limit, 10) || 20 });
    const viewData = prepareLogHistoryListData(result, req.query);

    return res.render("admin/logs/history", {
      pageTitle: "Istorija logova",
      pageDescription: "Pregled prethodnih dnevnih izveštaja",
      data: viewData,
    });
  } catch (error) {
    logError("[logHistoryList] Greška pri učitavanju istorije logova", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function logSummaryDetail(req, res, next) {
  try {
    const { date } = req.params;
    const summary = await logReportService.getLogSummaryByDate(date);

    if (!summary) {
      return flashAndRedirect(req, res, "error", `Nema sačuvanog izveštaja za ${date}`, "/admin/logovi/istorija");
    }

    const viewData = prepareLogSummaryDetailData(summary);

    return res.render("admin/logs/detail", {
      pageTitle: `Log izveštaj - ${date}`,
      pageDescription: `Detalji za ${date}`,
      data: viewData,
    });
  } catch (error) {
    logError("[logSummaryDetail] Greška pri učitavanju detalja log izveštaja", error, { date: req.params.date, userId: req.session?.user?.id });
    next(error);
  }
}

export default { logDashboard, logHistoryList, logSummaryDetail };