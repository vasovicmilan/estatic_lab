import * as contactService from "../../../../services/contact.service.js";
import { prepareContactListData, prepareContactDetailsData } from "../../../../presenters/admin/marketing/contact.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listContacts(req, res, next) {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    const result = await contactService.listContacts({
      search: search || "",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareContactListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Kontakt poruke",
      pageDescription: "Pregled svih poruka sa kontakt forme",
      data: viewData,
    });
  } catch (error) {
    logError("[listContacts] Greška pri učitavanju liste kontakt poruka", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function contactDetails(req, res, next) {
  try {
    const { contactId } = req.params;
    const contact = await contactService.getContactById(contactId);
    const viewData = prepareContactDetailsData(contact);

    // opening a message the admin hasn't seen yet marks it read, so the list badge clears
    if (contact.osnovno.statusRaw === "new") {
      await contactService.updateContactStatus(contactId, "read");
    }

    return res.render("admin/_details", {
      pageTitle: `Poruka - ${contact.osnovno.ime}`,
      pageDescription: contact.osnovno.email,
      data: viewData,
    });
  } catch (error) {
    logError("[contactDetails] Greška pri učitavanju detalja poruke", error, { contactId: req.params.contactId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateContactStatus(req, res, next) {
  try {
    const { contactId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateContactStatus] Validacione greške za contactId=${contactId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/kontakt/detalji/${contactId}`);
    }

    await contactService.updateContactStatus(contactId, req.body.status);
    logInfo(`[updateContactStatus] Status poruke #${contactId} promenjen na "${req.body.status}"`, { contactId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Status poruke je uspešno promenjen", `/admin/kontakt/detalji/${contactId}`);
  } catch (error) {
    logError("[updateContactStatus] Greška pri promeni statusa poruke", error, { contactId: req.params.contactId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/kontakt/detalji/${req.params.contactId}`);
    }
    next(error);
  }
}

export default {
  listContacts,
  contactDetails,
  updateContactStatus,
};
