export function parseJsonFields(...fieldNames) {
  return (req, res, next) => {
    for (const field of fieldNames) {
      if (typeof req.body[field] === "string") {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch {
        }
      }
    }
    next();
  };
}

export default { parseJsonFields };