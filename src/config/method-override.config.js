export function setupMethodOverride(app) {
  app.use((req, res, next) => {
    if (req.method === "POST") {
      const method = req.body?._method || req.query?._method;
      if (method && ["PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
        req.method = method.toUpperCase();
        req.originalMethod = "POST";
      }
    }
    next();
  });
}
