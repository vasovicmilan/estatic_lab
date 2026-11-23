import EmployeeCard from "../models/employee-card.model.js";

function applyPopulate(query, populateFields = []) {
  for (const field of populateFields) query = query.populate(field);
  return query;
}

export async function findCardByEmployee(employeeId, { populateFields = [] } = {}) {
  return applyPopulate(EmployeeCard.findOne({ employee: employeeId }), populateFields).lean();
}

export async function findCardBySlug(slug, { populateFields = [] } = {}) {
  return applyPopulate(EmployeeCard.findOne({ slug }), populateFields).lean();
}

export async function findCardById(id, { populateFields = [] } = {}) {
  return applyPopulate(EmployeeCard.findById(id), populateFields).lean();
}

export async function slugExists(slug) {
  return !!(await EmployeeCard.exists({ slug }));
}

export async function createCard(data) {
  const card = await EmployeeCard.create(data);
  return card.toObject();
}

export async function updateCardById(id, update) {
  return EmployeeCard.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
}

export async function incrementCounter(id, field) {
  await EmployeeCard.updateOne({ _id: id }, { $inc: { [field]: 1 } });
}

export async function findCards({ populateFields = [], limit = 200 } = {}) {
  return applyPopulate(EmployeeCard.find({}).sort({ createdAt: -1 }).limit(limit), populateFields).lean();
}

export default { findCardByEmployee, findCardBySlug, findCardById, slugExists, createCard, updateCardById, incrementCounter, findCards };
