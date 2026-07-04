export function localsMiddleware(req, res, next) {
  res.locals.currentPath = req.path;
  res.locals.isLoggedIn = !!req.session?.isLoggedIn;
  res.locals.user = req.session?.user || null;

  res.locals.success = req.flash ? req.flash("success") : [];
  res.locals.error = req.flash ? req.flash("error") : [];
  res.locals.info = req.flash ? req.flash("info") : [];
  res.locals.warning = req.flash ? req.flash("warning") : [];

  next();
}

export default localsMiddleware;
