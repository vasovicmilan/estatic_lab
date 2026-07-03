export function flashAndRedirect(req, res, type, message, url) {
  req.flash(type, message);
  req.session.save((err) => {
    if (err) {
      console.error("[flashAndRedirect] session.save error:", err);
    }
    return res.redirect(url);
  });
}