export function sanitizeArrayFields(...fieldNames) {
  return (req, res, next) => {
    for (const field of fieldNames) {
      if (Array.isArray(req.body[field])) {
        req.body[field] = req.body[field].filter(Boolean);
      }
    }
    next();
  };
}

export default { sanitizeArrayFields };