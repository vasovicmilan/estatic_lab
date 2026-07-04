import Contact from "../models/contact.model.js";
import { buildContactFilter } from "./filters/contact.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createContact(data, { session } = {}) {
  const [contact] = await Contact.create([data], { session });
  return contact;
}

export async function findContactById(id, { session } = {}) {
  return Contact.findById(id).session(session || null).lean();
}

export async function findContacts({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildContactFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(resolvedLimit)
      .session(session || null)
      .lean(),
    Contact.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updateContactById(id, updateData, { session } = {}) {
  return Contact.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, session }).lean();
}

export async function deleteContactById(id, { session } = {}) {
  return Contact.findByIdAndDelete(id, { session }).lean();
}

export async function countContacts(filters = {}, { session } = {}) {
  return Contact.countDocuments(buildContactFilter(filters)).session(session || null);
}
