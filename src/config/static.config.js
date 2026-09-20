import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";

// Public/static files (product & blog images, uploads, built CSS/JS, fonts)
// are meant to be embeddable by more than just this app's own EJS views -
// notably a separate frontend (the Angular app, today on localhost:4200,
// later on its own domain in production). helmet.config.js sets
// crossOriginResourcePolicy: "same-site" globally, which the browser enforces
// independently of CORS: even with the right CORS_ORIGINS entry, an <img>/
// <link>/font request for one of these files from a genuinely different
// origin gets blocked by that header before CORS is even considered.
//
// The fix is scoped to express.static's own setHeaders hook rather than a
// blanket app.use(...) override, so it only ever touches the header on an
// actual static-file response - HTML pages and /api JSON (which don't need
// to be cross-origin-embeddable, and where CORS is already deliberately
// origin-restricted in cors.config.js) are completely unaffected.
function allowCrossOriginStaticAssets(res) {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  // Plain <img>/<link>/<script> tag loading doesn't need this (only CORP
  // above matters there), but it's added too so a future canvas/fetch()
  // consumer of these already-public files isn't blocked by SOP either -
  // safe here since these are read-only, non-credentialed, already-public
  // assets, unlike /api which stays restricted to CORS_ORIGINS.
  res.setHeader("Access-Control-Allow-Origin", "*");
}

export function setupStatic(app) {
  app.use(
    express.static(path.join(__dirname, "..", "public"), {
      maxAge: isProd ? "30d" : 0,
      setHeaders: allowCrossOriginStaticAssets,
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
      setHeaders: allowCrossOriginStaticAssets,
    })
  );
}