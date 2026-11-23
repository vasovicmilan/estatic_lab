import employeeCardService from "../../../../services/employee-card.service.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { logError } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

const PAGE = "/admin/vizitke";

export async function listCards(req, res, next) {
  try {
    const cards = await employeeCardService.listCardsForAdmin();
    return res.render("admin/employee-cards", {
      pageTitle: "Vizitke zaposlenih",
      pageDescription: "Pregled i isključivanje javnih vizitki zaposlenih",
      data: { cards, csrfToken: res.locals.csrfToken, breadcrumbs: [{ label: "Vizitke zaposlenih" }] },
    });
  } catch (error) {
    logError("[listCards] Greška pri učitavanju vizitki", error);
    next(error);
  }
}

// isključi / vrati javnu vizitku (zaposleni je ne može sam da vrati dok je admin blokira)
export async function setStatus(req, res, next) {
  try {
    const disabled = parseCheckbox(req.body.disabled, false);
    await employeeCardService.setAdminDisabled(req.params.cardId, disabled);
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: disabled ? "EMPLOYEE_CARD_DISABLED" : "EMPLOYEE_CARD_ENABLED",
      entity: { type: "EmployeeCard", id: req.params.cardId },
      changes: { adminDisabled: { old: !disabled, new: disabled } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", disabled ? "Vizitka je isključena" : "Vizitka je ponovo dozvoljena", PAGE);
  } catch (error) {
    logError("[setStatus] Greška pri promeni statusa vizitke", error, { cardId: req.params.cardId });
    if (error.statusCode) return flashAndRedirect(req, res, "error", error.message, PAGE);
    next(error);
  }
}

export default { listCards, setStatus };
