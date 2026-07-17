/**
 * Builds the Mongo filter object for Order list queries.
 */
export function buildOrderFilter({
  search = "",
  user = null,
  status = null,
  statusIn = null,
  dateFrom = null,
  dateTo = null,
  minTotal = undefined,
  maxTotal = undefined,
  ids = null,
} = {}) {
  const filter = {};

  if (user) filter.user = user;

  if (status) filter.status = status;
  if (statusIn) filter.status = { $in: statusIn };

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = dateFrom;
    if (dateTo) filter.createdAt.$lt = dateTo;
  }

  if (minTotal !== undefined || maxTotal !== undefined) {
    filter.totalPrice = {};
    if (minTotal !== undefined) filter.totalPrice.$gte = minTotal;
    if (maxTotal !== undefined) filter.totalPrice.$lte = maxTotal;
  }

  if (search) {
    // matches against the contact snapshot and line-item titles, since an order
    // isn't always worth a $lookup just to search by name
    filter.$or = [
      { "contactSnapshot.firstName": { $regex: search, $options: "i" } },
      { "contactSnapshot.lastName": { $regex: search, $options: "i" } },
      { "contactSnapshot.email": { $regex: search, $options: "i" } },
      { "items.title": { $regex: search, $options: "i" } },
    ];
  }

  if (ids && Array.isArray(ids) && ids.length > 0) {
    filter._id = { $in: ids };
  }

  return filter;
}