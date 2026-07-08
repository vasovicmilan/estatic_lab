import eventEmitter from "../events/event.emitter.js";
import contactRepo from "../repositories/contact.repository.js";
import { mapContactsForAdminList, mapContactForAdminDetail, mapContactForUserShort } from "../mappers/contact.mapper.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { encryptField } from "../utils/encrypted-field.util.js";

export async function listContacts({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await contactRepo.findContacts({ search, limit, page, filters });
  return { data: mapContactsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getContactById(contactId) {
  if (!contactId) validationError("contactId");
  const contact = await contactRepo.findContactById(contactId);
  if (!contact) notFound("Poruka");
  return mapContactForAdminDetail(contact);
}

export async function submitContact(data, { ip, userAgent } = {}) {
  if (!data) validationError("data");
  if (!data.firstName) validationError("firstName");
  if (!data.lastName) validationError("lastName");
  if (!data.email) validationError("email");
  if (!data.message) validationError("message");
  if (!data.consent) badRequest("Morate prihvatiti uslove korišćenja da biste poslali poruku");

  const created = await contactRepo.createContact({
    firstName: data.firstName,
    lastName: encryptField(data.lastName),
    email: data.email,
    phone: encryptField(data.phone),
    topic: data.topic || "",
    message: encryptField(data.message),
    consent: true,
    ip,
    userAgent,
  });

  logInfo("Contact message submitted", { contactId: created._id, email: created.email });

  // NOTE: deliberately using the original plaintext data.lastName/data.message here,
  // not created.lastName/created.message — those are now ciphertext, and this event
  // likely feeds an admin notification email/webhook that needs the real text.
  eventEmitter.emit("contact:created", {
    contactId: created._id,
    firstName: created.firstName,
    lastName: data.lastName,
    email: created.email,
    message: data.message,
  });

  return mapContactForUserShort(created);
}

export async function updateContactStatus(contactId, status) {
  if (!contactId) validationError("contactId");
  if (!["new", "read", "replied", "archived"].includes(status)) badRequest("Nepoznat status poruke");

  const updated = await contactRepo.updateContactById(contactId, { status });
  if (!updated) notFound("Poruka");
  logInfo("Contact status changed", { contactId, status });
  return getContactById(updated._id);
}

export default {
  listContacts,
  getContactById,
  submitContact,
  updateContactStatus,
};