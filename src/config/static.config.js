import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";

export function setupStatic(app) {
  app.use(
    express.static(path.join(__dirname, "..", "public"), {
      maxAge: isProd ? "30d" : 0,
    })
  );

  app.use(
    "/bootstrap/css",
    express.static(path.join(__dirname, "..", "..", "node_modules", "bootstrap", "dist", "css"), {
      maxAge: isProd ? "30d" : 0,
    })
  );

  app.use(
    "/bootstrap/js",
    express.static(path.join(__dirname, "..", "..", "node_modules", "bootstrap", "dist", "js"), {
      maxAge: isProd ? "30d" : 0,
    })
  );

  app.use(
    "/bootstrap-icons",
    express.static(path.join(__dirname, "..", "..", "node_modules", "bootstrap-icons", "font"), {
      maxAge: isProd ? "30d" : 0,
    })
  );
}