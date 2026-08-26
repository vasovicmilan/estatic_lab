import businessReportService from "../../../../services/business-report.service.js";
import {
  prepareBusinessReportDashboardData,
  prepareBusinessReportHistoryData,
  prepareBusinessReportDetailData,
} from "../../../../presenters/admin/reports/business-report.presenter.js";
import { logError } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

const PERIOD_TYPES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export async function businessReportDashboard(req, res, next) {
  try {
    const entries = await Promise.all(PERIOD_TYPES.map(async (periodType) => [periodType, await businessReportService.getCurrentSummary(periodType)]));
    const summariesByType = Object.fromEntries(entries);
    const viewData = prepareBusinessReportDashboardData(summariesByType);

    return res.render("admin/reports/dashboard", {
      pageTitle: "Poslovni izveštaji",
      pageDescription: "Pregled zakazivanja, prodaje, paketa, provizija i kupona",
      data: viewData,
    });
  } catch (error) {
    logError("[businessReportDashboard] Greška pri učitavanju pregleda poslovnih izveštaja", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function businessReportHistoryList(req, res, next) {
  try {
    const { periodType } = req.params;
    if (!PERIOD_TYPES.includes(periodType)) {
      return flashAndRedirect(req, res, "error", "Nepoznat tip perioda", "/admin/poslovni-izvestaji");
    }

    const { page = 1, limit = 20 } = req.query;
    const result = await businessReportService.listSummaries(periodType, { page: parseInt(page, 10) || 1, limit: parseInt(limit, 10) || 20 });
    const viewData = prepareBusinessReportHistoryData(periodType, result, req.query);

    return res.render("admin/reports/history", {
      pageTitle: `Istorija - ${viewData.periodLabel} izveštaji`,
      pageDescription: "Pregled prethodnih izveštaja",
      data: viewData,
    });
  } catch (error) {
    logError("[businessReportHistoryList] Greška pri učitavanju istorije poslovnih izveštaja", error, { ...req.params, ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function businessReportDetail(req, res, next) {
  try {
    const { periodType, periodKey } = req.params;
    if (!PERIOD_TYPES.includes(periodType)) {
      return flashAndRedirect(req, res, "error", "Nepoznat tip perioda", "/admin/poslovni-izvestaji");
    }

    const summary = await businessReportService.getSummary(periodType, periodKey);
    if (!summary) {
      return flashAndRedirect(req, res, "error", `Nema sačuvanog izveštaja za ${periodKey}`, `/admin/poslovni-izvestaji/istorija/${periodType}`);
    }

    const viewData = prepareBusinessReportDetailData(summary);

    return res.render("admin/reports/detail", {
      pageTitle: `Poslovni izveštaj - ${periodKey}`,
      pageDescription: `Detalji za ${periodKey}`,
      data: viewData,
    });
  } catch (error) {
    logError("[businessReportDetail] Greška pri učitavanju detalja poslovnog izveštaja", error, { ...req.params, userId: req.session?.user?.id });
    next(error);
  }
}

export default { businessReportDashboard, businessReportHistoryList, businessReportDetail };
