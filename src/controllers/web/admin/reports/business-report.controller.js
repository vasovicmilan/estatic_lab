import businessReportService from "../../../../services/business-report.service.js";
import {
  prepareBusinessReportDashboardData,
  prepareBusinessReportHistoryData,
  prepareBusinessReportDetailData,
} from "../../../../presenters/admin/reports/business-report.presenter.js";
import { generateBusinessReportPdf } from "../../../../utils/business-report-pdf.util.js";
import { logError } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

const PERIOD_TYPES = ["daily", "weekly", "monthly", "quarterly", "yearly"];
const PERIOD_LABELS = {
  daily: "Dnevni poslovni izveštaj",
  weekly: "Nedeljni poslovni izveštaj",
  monthly: "Mesečni poslovni izveštaj",
  quarterly: "Kvartalni poslovni izveštaj",
  yearly: "Godišnji poslovni izveštaj",
};

export async function businessReportDashboard(req, res, next) {
  try {
    const entries = await Promise.all(PERIOD_TYPES.map(async (periodType) => [periodType, await businessReportService.getCurrentPeriodSummaryLive(periodType)]));
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

export async function businessReportDownloadPdf(req, res, next) {
  try {
    const { periodType, periodKey } = req.params;
    if (!PERIOD_TYPES.includes(periodType)) {
      return flashAndRedirect(req, res, "error", "Nepoznat tip perioda", "/admin/poslovni-izvestaji");
    }

    // Deliberately the RAW summary (businessReportService.getSummary, not run
    // through prepareBusinessReportDetailData) - the presenter above already
    // formats every number through formatMoney() for HTML display, and
    // generateBusinessReportPdf does that formatting itself. Feeding it the
    // presenter's already-formatted strings would double-format them.
    const summary = await businessReportService.getSummary(periodType, periodKey);
    if (!summary) {
      return flashAndRedirect(req, res, "error", `Nema sačuvanog izveštaja za ${periodKey}`, `/admin/poslovni-izvestaji/istorija/${periodType}`);
    }

    const rangeLabel = `${new Date(summary.periodStart).toLocaleDateString("sr-RS")} - ${new Date(summary.periodEnd.getTime() - 1).toLocaleDateString("sr-RS")}`;
    const pdfBuffer = await generateBusinessReportPdf(PERIOD_LABELS[periodType], rangeLabel, summary);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="poslovni-izvestaj-${periodKey}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    logError("[businessReportDownloadPdf] Greška pri generisanju PDF izveštaja", error, { ...req.params, userId: req.session?.user?.id });
    next(error);
  }
}

export default { businessReportDashboard, businessReportHistoryList, businessReportDetail, businessReportDownloadPdf };
