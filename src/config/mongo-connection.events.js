import mongoose from "mongoose";
// Imported as the default export objects (not the named functions) specifically so
// unit tests can patch them with t.mock.method - a named import is a live binding to
// the source module's internal variable, not to a mutable object property, so it
// can't be swapped out per-test the way these default objects can.
import loggerUtil from "../utils/logger.util.js";
import telegramAlertUtil from "../utils/telegram-alert.util.js";

// Without these listeners, a lost MongoDB connection was invisible until it started
// producing request-level 500s - each one indistinguishable from an ordinary bug in
// the Telegram feed, several of them together burning through the 5-alerts/minute
// global ceiling before a human could tell "one outage" from "five unrelated bugs".
// These three listeners give the DB connection its own, clearly-labeled alert path
// (see the message text below) so a responder recognizes a DB outage instantly
// instead of reconstructing it from a pile of unrelated-looking request errors.
//
// Exported as a function (not run at import time) so it can be pointed at a fake
// EventEmitter in a unit test - real mongoose.connection is the default so
// production code doesn't have to pass anything.
export function registerMongoConnectionListeners(connection = mongoose.connection) {
  connection.on("error", (err) => {
    loggerUtil.logError("MongoDB connection error", err);
    telegramAlertUtil.alertError("MongoDB konekcija izgubljena - greška na konekciji sa bazom", {
      source: "mongoose",
      event: "error",
      message: err?.message,
    });
  });

  connection.on("disconnected", () => {
    loggerUtil.logError("MongoDB disconnected");
    telegramAlertUtil.alertError("MongoDB konekcija izgubljena - baza je nedostupna", {
      source: "mongoose",
      event: "disconnected",
    });
  });

  // Recovery is only worth a log line, not a Telegram ping - the outage itself
  // already paged above, and a second message just for "it's back" would spend
  // more of the rate-limit budget without giving the responder anything to act on.
  connection.on("reconnected", () => {
    loggerUtil.logInfo("MongoDB reconnected");
  });
}

export default { registerMongoConnectionListeners };
