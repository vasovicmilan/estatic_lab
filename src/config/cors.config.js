import cors from "cors";

export function setupCors(app) {
  app.use(
    cors({
      origin: process.env.BASE_URL || true,
      credentials: true,
    })
  );
}
