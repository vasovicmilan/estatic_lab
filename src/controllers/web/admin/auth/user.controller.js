import * as userService from "../../../../services/user.service.js";
import * as authService from "../../../../services/auth.service.js";
import * as roleService from "../../../../services/role.service.js";
import { prepareUserListData, prepareUserDetailsData } from "../../../../presenters/admin/auth/user.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listUsers(req, res, next) {
  try {
    const { search, status, role, provider, page = 1, limit = 10 } = req.query;

    const result = await userService.listUsers({
      search: search || "",
      status: status || undefined,
      role: role || undefined,
      provider: provider || undefined,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareUserListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Korisnici",
      pageDescription: "Pregled svih korisnika",
      data: viewData,
    });
  } catch (error) {
    logError("[listUsers] Greška pri učitavanju liste korisnika", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function userDetails(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);
    const roleOptions = await roleService.getRolesForSelect();
    const viewData = prepareUserDetailsData(user, roleOptions);

    return res.render("admin/_details", {
      pageTitle: `Korisnik — ${user.imePrezime}`,
      pageDescription: user.email,
      data: viewData,
    });
  } catch (error) {
    logError("[userDetails] Greška pri učitavanju detalja korisnika", error, {
      userId: req.params.userId,
      adminId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { userId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateUserStatus] Validacione greške za userId=${userId}`, { validationErrors: req.validationErrors, adminId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/korisnici/detalji/${userId}`);
    }

    await userService.updateUserStatus(userId, req.body.status);
    logInfo(`[updateUserStatus] Status korisnika #${userId} promenjen na "${req.body.status}"`, { userId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Status korisnika je uspešno promenjen", `/admin/korisnici/detalji/${userId}`);
  } catch (error) {
    logError("[updateUserStatus] Greška pri promeni statusa korisnika", error, {
      userId: req.params.userId,
      requestedStatus: req.body.status,
      adminId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/korisnici/detalji/${req.params.userId}`);
    }
    next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { userId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateUserRole] Validacione greške za userId=${userId}`, { validationErrors: req.validationErrors, adminId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/korisnici/detalji/${userId}`);
    }

    await userService.updateUserRole(userId, req.body.role);
    logInfo(`[updateUserRole] Rola korisnika #${userId} promenjena`, { userId, newRole: req.body.role, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Rola korisnika je uspešno promenjena", `/admin/korisnici/detalji/${userId}`);
  } catch (error) {
    logError("[updateUserRole] Greška pri promeni role korisnika", error, {
      userId: req.params.userId,
      requestedRole: req.body.role,
      adminId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/korisnici/detalji/${req.params.userId}`);
    }
    next(error);
  }
}

export async function verifyUser(req, res, next) {
  try {
    const { userId } = req.params;
    await authService.verifyAccountByAdmin(userId);
    logInfo(`[verifyUser] Korisnik #${userId} ručno verifikovan od strane admina`, { userId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Nalog korisnika je uspešno verifikovan", `/admin/korisnici/detalji/${userId}`);
  } catch (error) {
    logError("[verifyUser] Greška pri verifikaciji korisnika", error, { userId: req.params.userId, adminId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/korisnici/detalji/${req.params.userId}`);
    }
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    await userService.deleteUser(userId);
    logInfo(`[deleteUser] Korisnik #${userId} obrisan`, { userId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Korisnik je uspešno obrisan", "/admin/korisnici");
  } catch (error) {
    logError("[deleteUser] Greška pri brisanju korisnika", error, { userId: req.params.userId, adminId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/korisnici");
    }
    next(error);
  }
}

export default {
  listUsers,
  userDetails,
  updateUserStatus,
  updateUserRole,
  verifyUser,
  deleteUser,
};