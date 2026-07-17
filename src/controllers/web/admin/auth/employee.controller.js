import * as employeeService from "../../../../services/employee.service.js";
import * as userService from "../../../../services/user.service.js";
import * as serviceService from "../../../../services/service.service.js";
import * as expertService from "../../../../services/expert.service.js";
import { prepareEmployeeListData, prepareEmployeeDetailsData, prepareEmployeeFormData } from "../../../../presenters/admin/auth/employee.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

async function loadFormOptions() {
  const [users, services, experts] = await Promise.all([
    userService.listUsers({ role: undefined, status: "active", limit: 200 }),
    serviceService.listServices({ limit: 200 }),
    expertService.listExperts({ limit: 200 }),
  ]);

  return {
    userOptions: users.data.map((u) => ({ value: u.id, label: `${u.imePrezime} (${u.email})` })),
    serviceOptions: services.data.map((s) => ({ value: s.id, label: s.naziv })),
    expertOptions: experts.data.map((e) => ({ value: e.id, label: e.imePrezime })),
  };
}

export async function listEmployees(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;

    const result = await employeeService.listEmployees({
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareEmployeeListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Zaposleni",
      pageDescription: "Pregled svih zaposlenih",
      data: viewData,
    });
  } catch (error) {
    logError("[listEmployees] Greška pri učitavanju liste zaposlenih", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function employeeDetails(req, res, next) {
  try {
    const { employeeId } = req.params;
    const employee = await employeeService.getEmployeeById(employeeId, "admin", "detail");
    const viewData = prepareEmployeeDetailsData(employee);

    return res.render("admin/_details", {
      pageTitle: `Zaposleni - ${employee.korisnik.imePrezime}`,
      pageDescription: employee.korisnik.email,
      data: viewData,
    });
  } catch (error) {
    logError("[employeeDetails] Greška pri učitavanju detalja zaposlenog", error, {
      employeeId: req.params.employeeId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function newEmployeeForm(req, res, next) {
  try {
    const options = await loadFormOptions();
    const formData = prepareEmployeeFormData(null, options);
    return res.render("admin/_form", {
      pageTitle: "Novi zaposleni",
      pageDescription: "Kreiraj profil zaposlenog",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newEmployeeForm] Greška pri prikazu forme za novog zaposlenog", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editEmployeeForm(req, res, next) {
  try {
    const { employeeId } = req.params;
    const employee = await employeeService.getEmployeeForEdit(employeeId);
    const options = await loadFormOptions();
    const formData = prepareEmployeeFormData(employee, options);

    return res.render("admin/_form", {
      pageTitle: `Izmena - ${employee.imePrezime}`,
      pageDescription: employee.email,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editEmployeeForm] Greška pri učitavanju forme za izmenu zaposlenog", error, {
      employeeId: req.params.employeeId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function createEmployee(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createEmployee] Validacione greške pri kreiranju zaposlenog", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const options = await loadFormOptions();
      const formData = prepareEmployeeFormData(null, options);
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi zaposleni",
        pageDescription: "Kreiraj profil zaposlenog",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const employee = await employeeService.createEmployee(req.body);
    logInfo(`[createEmployee] Zaposleni kreiran za korisnika #${req.body.userId}`, { employeeId: employee.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Zaposleni je uspešno kreiran", `/admin/zaposleni/detalji/${employee.id}`);
  } catch (error) {
    logError("[createEmployee] Greška pri kreiranju zaposlenog", error, { body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 409) {
      const options = await loadFormOptions();
      const formData = prepareEmployeeFormData(null, options);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Novi zaposleni",
        pageDescription: "Kreiraj profil zaposlenog",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateEmployee(req, res, next) {
  try {
    const { employeeId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateEmployee] Validacione greške za employeeId=${employeeId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const employee = await employeeService.getEmployeeForEdit(employeeId);
      const options = await loadFormOptions();
      const formData = prepareEmployeeFormData(employee, options);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena - ${employee.imePrezime}`,
        pageDescription: employee.email,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const updated = await employeeService.updateEmployeeById(employeeId, req.body);
    logInfo(`[updateEmployee] Zaposleni #${employeeId} ažuriran`, { employeeId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Zaposleni je uspešno ažuriran", `/admin/zaposleni/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateEmployee] Greška pri ažuriranju zaposlenog", error, {
      employeeId: req.params.employeeId,
      body: req.body,
      userId: req.session?.user?.id,
    });

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
      const employee = await employeeService.getEmployeeForEdit(req.params.employeeId).catch(() => null);
      const options = await loadFormOptions();
      const formData = prepareEmployeeFormData(employee, options);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: employee ? `Izmena - ${employee.imePrezime}` : "Izmena zaposlenog",
        pageDescription: employee?.email || "",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updateWorkingHours(req, res, next) {
  try {
    const { employeeId } = req.params;
    const actorId = req.session?.user?.id;
    const actorRole = req.session?.user?.roleName;

    await employeeService.manageWorkingHours(employeeId, req.body.workingHours || [], actorId, actorRole);
    logInfo(`[updateWorkingHours] Radno vreme zaposlenog #${employeeId} ažurirano`, { employeeId, actorId });

    return flashAndRedirect(req, res, "success", "Radno vreme je uspešno ažurirano", `/admin/zaposleni/detalji/${employeeId}`);
  } catch (error) {
    logError("[updateWorkingHours] Greška pri ažuriranju radnog vremena", error, {
      employeeId: req.params.employeeId,
      userId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/zaposleni/detalji/${req.params.employeeId}`);
    }
    next(error);
  }
}

export async function deleteEmployee(req, res, next) {
  try {
    const { employeeId } = req.params;
    await employeeService.deleteEmployeeById(employeeId);
    logInfo(`[deleteEmployee] Zaposleni #${employeeId} obrisan`, { employeeId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Zaposleni je uspešno obrisan", "/admin/zaposleni");
  } catch (error) {
    logError("[deleteEmployee] Greška pri brisanju zaposlenog", error, { employeeId: req.params.employeeId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/zaposleni");
    }
    next(error);
  }
}

export default {
  listEmployees,
  employeeDetails,
  newEmployeeForm,
  editEmployeeForm,
  createEmployee,
  updateEmployee,
  updateWorkingHours,
  deleteEmployee,
};