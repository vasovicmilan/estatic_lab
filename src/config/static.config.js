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

  // Note: no /bootstrap/css route anymore. bootstrap.min.css (full, unbuilt
  // Bootstrap dist) was replaced by a custom Sass build compiled to
  // src/public/css/bootstrap.custom.min.css (see npm run build:css and
  // src/assets/scss/custom-bootstrap.scss) - it's already served by the
  // express.static(...public...) line above like any other public asset.

  // Note: no /bootstrap-icons route anymore either. The full bootstrap-icons
  // font (134 KiB woff2 for ~2000 icons) was replaced by a subset containing
  // only the 71 glyphs actually used (see npm run build:icons and
  // scripts/build-icon-subset.mjs) - already served by the express.static(...
  // public...) line above like any other public asset.

  app.use(
    "/bootstrap/js",
    express.static(path.join(__dirname, "..", "..", "node_modules", "bootstrap", "dist", "js"), {
      maxAge: isProd ? "30d" : 0,
    })
  );
}