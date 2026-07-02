export function buildPostFilter({
  search = "",
  status = null,
  category = null,
  tag = null,
  author = null,
  publishedOnly = false,
} = {}) {
  const filter = {};

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
    ];
  }

  if (category) filter.categories = category;
  if (tag) filter.tags = tag;
  if (author) filter.author = author;

  if (publishedOnly) {
    filter.status = "published";
    filter.publishedAt = { $lte: new Date() };
  } else if (status) {
    filter.status = status;
  }

  return filter;
}