/**
 * Minimal in-house replacement for connect-flash (0.1.1, last published ~2013,
 * unmaintained since). That package is the actual source of the Node
 * `util.isArray` deprecation warning seen in test output - it does
 * `require('util').isArray` at module load time (every single request cycle
 * that builds the app triggers it), which Node has deprecated in favor of the
 * built-in `Array.isArray`.
 *
 * Only implements the two call shapes actually used anywhere in this codebase
 * (verified by grepping every `req.flash(...)` call site before writing this):
 *   req.flash(type, message)  - queue a single string message under `type`
 *   req.flash(type)           - read and clear all queued messages for `type`
 *
 * connect-flash's own richer behavior (pushing an array of messages in one
 * call, util.format-style %s interpolation with extra arguments, and
 * `req.flash()` with no arguments to read/clear everything at once) is
 * deliberately NOT reproduced here, since nothing in this codebase relies on
 * it - reproducing unused surface area would just be more code to maintain
 * for no real benefit.
 */
function flashMessage(type, message) {
  if (this.session === undefined) throw new Error("req.flash() requires sessions");
  const messagesByType = (this.session.flash = this.session.flash || {});

  if (type && message !== undefined) {
    messagesByType[type] = messagesByType[type] || [];
    messagesByType[type].push(message);
    return messagesByType[type].length;
  }

  if (type) {
    const messages = messagesByType[type];
    delete messagesByType[type];
    return messages || [];
  }

  this.session.flash = {};
  return messagesByType;
}

export default function flash() {
  return function (req, res, next) {
    if (!req.flash) req.flash = flashMessage;
    next();
  };
}
