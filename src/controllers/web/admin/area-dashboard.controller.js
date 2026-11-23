import adminDashboardService from "../../../services/admin-dashboard.service.js";
import { prepareBlogDashboardData, prepareShopDashboardData, prepareCatalogDashboardData } from "../../../presenters/admin/area-dashboard.presenter.js";
import { logError } from "../../../utils/logger.util.js";

function render(res, data, description) {
  return res.render("admin/dashboard", { pageTitle: data.title, pageDescription: description, data });
}

export async function blogDashboard(req, res, next) {
  try {
    return render(res, prepareBlogDashboardData(await adminDashboardService.getBlogDashboard()), "Stanje bloga");
  } catch (error) {
    logError("[blogDashboard] Greška", error, { adminId: req.session?.user?.id });
    next(error);
  }
}

export async function shopDashboard(req, res, next) {
  try {
    const data = await adminDashboardService.getShopDashboard({ permissions: req.user?.permissions });
    return render(res, prepareShopDashboardData(data), "Stanje prodavnice");
  } catch (error) {
    logError("[shopDashboard] Greška", error, { adminId: req.session?.user?.id });
    next(error);
  }
}

export async function catalogDashboard(req, res, next) {
  try {
    const data = await adminDashboardService.getCatalogDashboard({ permissions: req.user?.permissions });
    return render(res, prepareCatalogDashboardData(data), "Stanje usluga i paketa");
  } catch (error) {
    logError("[catalogDashboard] Greška", error, { adminId: req.session?.user?.id });
    next(error);
  }
}

export default { blogDashboard, shopDashboard, catalogDashboard };
