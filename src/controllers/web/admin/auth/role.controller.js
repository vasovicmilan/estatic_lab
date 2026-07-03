import * as roleService from "../../../../services/role.service.js";
import { PERMISSIONS } from "../../../../models/role.model.js";
import { translatePermission } from "../../../../mappers/role.mapper.js";
import { prepareRoleListData, prepareRoleDetailsData, prepareRoleFormData } from "../../../../presenters/admin/auth/role.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

function getAvailablePermissions() {
  return PERMISSIONS.map((value) => ({ value, label: translatePermission(value) }));
}

export async function listRoles(req, res, next) {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const result = await roleService.listRoles({
      search: search || "",
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareRoleListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Role",
      pageDescription: "Pregled svih rola i njihovih permisija",
      data: viewData,
    });
  } catch (error) {
    logError("[listRoles] Greška pri učitavanju liste rola", error, {
      search: req.query.search,
      page: req.query.page,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function roleDetails(req, res, next) {
  try {
    const { roleId } = req.params;
    const role = await roleService.getRoleById(roleId);
    const viewData = prepareRoleDetailsData(role);

    return res.render("admin/_details", {
      pageTitle: `Rola — ${role.osnovno.naziv}`,
      pageDescription: role.osnovno.opis || role.osnovno.naziv,
      data: viewData,
    });
  } catch (error) {
    logError("[roleDetails] Greška pri učitavanju detalja role", error, {
      roleId: req.params.roleId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function newRoleForm(req, res, next) {
  try {
    const formData = prepareRoleFormData(null, getAvailablePermissions());
    return res.render("admin/_form", {
      pageTitle: "Nova rola",
      pageDescription: "Kreiraj novu rolu",
      data: { ...formData, errors: {}, csrfToken: req.csrfToken?.() },
    });
  } catch (error) {
    logError("[newRoleForm] Greška pri prikazu forme za novu rolu", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editRoleForm(req, res, next) {
  try {
    const { roleId } = req.params;
    const role = await roleService.getRoleForEdit(roleId);
    const formData = prepareRoleFormData(role, getAvailablePermissions());

    return res.render("admin/_form", {
      pageTitle: `Izmena — ${role.name}`,
      pageDescription: role.description || role.name,
      data: { ...formData, errors: {}, csrfToken: req.csrfToken?.() },
    });
  } catch (error) {
    logError("[editRoleForm] Greška pri učitavanju forme za izmenu role", error, {
      roleId: req.params.roleId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function createRole(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createRole] Validacione greške pri kreiranju role", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const formData = prepareRoleFormData(null, getAvailablePermissions());
      return res.status(400).render("admin/_form", {
        pageTitle: "Nova rola",
        pageDescription: "Kreiraj novu rolu",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: req.csrfToken?.() },
      });
    }

    const role = await roleService.createRole(req.body);
    logInfo(`[createRole] Rola kreirana: "${role.osnovno.naziv}"`, { roleId: role.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Rola je uspešno kreirana", `/admin/role/detalji/${role.id}`);
  } catch (error) {
    logError("[createRole] Greška pri kreiranju role", error, { body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 409) {
      const formData = prepareRoleFormData(null, getAvailablePermissions());
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Nova rola",
        pageDescription: "Kreiraj novu rolu",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: req.csrfToken?.() },
      });
    }
    next(error);
  }
}

export async function updateRole(req, res, next) {
  try {
    const { roleId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateRole] Validacione greške za roleId=${roleId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const role = await roleService.getRoleForEdit(roleId);
      const formData = prepareRoleFormData(role, getAvailablePermissions());
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena — ${role.name}`,
        pageDescription: role.description || role.name,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: req.csrfToken?.() },
      });
    }

    const updated = await roleService.updateRoleById(roleId, req.body);
    logInfo(`[updateRole] Rola #${roleId} ažurirana`, { roleId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Rola je uspešno ažurirana", `/admin/role/detalji/${updated.id}`);
  } catch (error) {
    logError("[updateRole] Greška pri ažuriranju role", error, { roleId: req.params.roleId, body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
      const role = await roleService.getRoleForEdit(req.params.roleId).catch(() => null);
      const formData = prepareRoleFormData(role, getAvailablePermissions());
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: role ? `Izmena — ${role.name}` : "Izmena role",
        pageDescription: role?.description || "",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: req.csrfToken?.() },
      });
    }
    next(error);
  }
}

export async function deleteRole(req, res, next) {
  try {
    const { roleId } = req.params;
    await roleService.deleteRoleById(roleId);
    logInfo(`[deleteRole] Rola #${roleId} obrisana`, { roleId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Rola je uspešno obrisana", "/admin/role");
  } catch (error) {
    logError("[deleteRole] Greška pri brisanju role", error, { roleId: req.params.roleId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/role");
    }
    next(error);
  }
}

export default {
  listRoles,
  roleDetails,
  newRoleForm,
  editRoleForm,
  createRole,
  updateRole,
  deleteRole,
};