import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import loggerUtil from "../../../src/utils/logger.util.js";
import telegramAlertUtil from "../../../src/utils/telegram-alert.util.js";
import { registerMongoConnectionListeners } from "../../../src/config/mongo-connection.events.js";

// A plain EventEmitter stands in for mongoose.connection - registerMongoConnectionListeners
// only ever calls connection.on(...), so this is a faithful fake without touching real mongoose.
function fakeConnection() {
  return new EventEmitter();
}

describe("mongo-connection.events - registerMongoConnectionListeners", () => {
  it("logs and sends a clearly-distinct Telegram alert on a connection error", (t) => {
    const logErrorMock = t.mock.method(loggerUtil, "logError", () => {});
    const alertMock = t.mock.method(telegramAlertUtil, "alertError", async () => {});
    const connection = fakeConnection();
    registerMongoConnectionListeners(connection);

    const err = new Error("connection reset");
    connection.emit("error", err);

    assert.equal(logErrorMock.mock.calls.length, 1);
    assert.equal(logErrorMock.mock.calls[0].arguments[0], "MongoDB connection error");
    assert.equal(logErrorMock.mock.calls[0].arguments[1], err);

    assert.equal(alertMock.mock.calls.length, 1);
    const [message, context] = alertMock.mock.calls[0].arguments;
    assert.match(message, /MongoDB/);
    assert.equal(context.event, "error");
  });

  it("logs and sends a distinct Telegram alert on disconnected, with wording that does not read like an ordinary request error", (t) => {
    const logErrorMock = t.mock.method(loggerUtil, "logError", () => {});
    const alertMock = t.mock.method(telegramAlertUtil, "alertError", async () => {});
    const connection = fakeConnection();
    registerMongoConnectionListeners(connection);

    connection.emit("disconnected");

    assert.equal(logErrorMock.mock.calls.length, 1);
    assert.equal(alertMock.mock.calls.length, 1);
    const [message, context] = alertMock.mock.calls[0].arguments;
    assert.match(message, /MongoDB konekcija izgubljena/);
    assert.equal(context.event, "disconnected");
  });

  it("logs recovery informationally on reconnected, without sending a Telegram alert", (t) => {
    const logInfoMock = t.mock.method(loggerUtil, "logInfo", () => {});
    const alertMock = t.mock.method(telegramAlertUtil, "alertError", async () => {});
    const connection = fakeConnection();
    registerMongoConnectionListeners(connection);

    connection.emit("reconnected");

    assert.equal(logInfoMock.mock.calls.length, 1);
    assert.match(logInfoMock.mock.calls[0].arguments[0], /reconnect/i);
    assert.equal(alertMock.mock.calls.length, 0);
  });
});
