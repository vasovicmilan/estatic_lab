export function buildContactFilter({ search = "", status = null } = {}) {
  const filter = {};

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      // topic is stored as plain text (unlike message/phone/lastName), so a
      // direct regex search works here - lets admin find e.g. every "Cena na
      // upit: ..." product price inquiry (see product-details.ejs) just by
      // typing that phrase into the same search box used for name/email
      { topic: { $regex: search, $options: "i" } },
    ];
  }

  if (status) filter.status = status;

  return filter;
}