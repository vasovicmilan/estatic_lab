import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import telegramService from "../../../src/services/telegram.service.js";
import { alertError } from "../../../src/utils/telegram-alert.util.js";

// alertError has two pieces of module-level, time-based state shared across every
// test in this file: the per-key 5-minute throttle (recentAlerts) and the global
// "max 5 alerts per any rolling minute" ceiling (windowStart/windowCount). Both read
// Date.now() internally with no way to inject a clock, so this suite runs its own
// fake clock (a single shared, monotonically-increasing timestamp) for the whole
// file instead of relying on real elapsed time - real time passing mid-suite would
// make the global 5/minute ceiling flaky depending on how fast the tests happen to
// run. Each test also jumps the clock forward by >5 minutes in beforeEach so the
// global per-minute window is guaranteed fresh AND any prior key's throttle window
// (irrelevant here anyway, since every test uses its own unique message) has passed.
let fakeNow = Date.now();

before(() => {
  mock.method(Date, "now", () => fakeNow);
});

after(() => {
  mock.restoreAll();
});

beforeEach(() => {
  fakeNow += 6 * 60 * 1000; // jump 6 minutes forward: clears both throttle state and the global per-minute ceiling
});

function uniqueMessage(label) {
  return `${label}-${Math.random().toString(36).slice(2)}`;
}

describe("telegram-alert.util - alertError throttle + repeat-count reporting", () => {
  it("sends immediately the first time a given message fires", async (t) => {
    const sendMock = t.mock.method(telegramService, "sendTelegramMessage", async () => ({}));
    const message = uniqueMessage("first-fire");

    await alertError(message, { statusCode: 500 });

    assert.equal(sendMock.mock.calls.length, 1);
    const [thread, text] = sendMock.mock.calls[0].arguments;
    assert.equal(thread, "ERRORS");
    assert.match(text, new RegExp(message));
    // No prior suppressions yet, so no repeat-count line.
    assert.ok(!text.includes("Ponovilo se"));
  });

  it("suppresses a repeat of the same message within the 5-minute throttle window and does not send", async (t) => {
    const sendMock = t.mock.method(telegramService, "sendTelegramMessage", async () => ({}));
    const message = uniqueMessage("throttled");

    await alertError(message);
    await alertError(message);
    await alertError(message);

    // Only the first of the three calls actually reached Telegram.
    assert.equal(sendMock.mock.calls.length, 1);
  });

  it("reports the suppressed count once the throttle window passes and the alert actually fires again", async (t) => {
    const sendMock = t.mock.method(telegramService, "sendTelegramMessage", async () => ({}));
    const message = uniqueMessage("repeat-count");

    await alertError(message); // sent (1st)
    await alertError(message); // suppressed -> suppressedCount 1
    await alertError(message); // suppressed -> suppressedCount 2

    fakeNow += 5 * 60 * 1000 + 1000; // past this key's own 5-minute throttle window

    await alertError(message); // throttle window has passed -> should send again

    assert.equal(sendMock.mock.calls.length, 2);
    const [, secondText] = sendMock.mock.calls[1].arguments;
    assert.match(secondText, /Ponovilo se 2x u poslednjih 5 minuta/);
  });

  it("resets the suppressed count after it is reported", async (t) => {
    const sendMock = t.mock.method(telegramService, "sendTelegramMessage", async () => ({}));
    const message = uniqueMessage("reset-after-report");

    await alertError(message); // sent
    await alertError(message); // suppressed -> count 1

    fakeNow += 5 * 60 * 1000 + 1000;
    await alertError(message); // sends, reports "1x", resets count back to 0

    fakeNow += 5 * 60 * 1000 + 1000;
    await alertError(message); // sends again - should report no repeats since count was reset

    assert.equal(sendMock.mock.calls.length, 3);
    const [, lastText] = sendMock.mock.calls[2].arguments;
    assert.ok(!lastText.includes("Ponovilo se"));
  });

  it("never throws, even when the underlying Telegram send rejects", async (t) => {
    t.mock.method(telegramService, "sendTelegramMessage", async () => {
      throw new Error("network down");
    });
    const message = uniqueMessage("send-fails");

    await assert.doesNotReject(alertError(message));
  });

  it("does not send once the global per-minute ceiling is hit, even for distinct, non-throttled keys", async (t) => {
    const sendMock = t.mock.method(telegramService, "sendTelegramMessage", async () => ({}));

    // 5 distinct keys back-to-back, all within the same (fake) minute: exactly the
    // global MAX_ALERTS_PER_MINUTE ceiling.
    for (let i = 0; i < 5; i++) {
      await alertError(uniqueMessage(`ceiling-${i}`));
    }
    assert.equal(sendMock.mock.calls.length, 5);

    // A 6th distinct key in the same window is dropped by the global ceiling, not
    // by the per-key throttle (it has never fired before).
    await alertError(uniqueMessage("ceiling-over"));
    assert.equal(sendMock.mock.calls.length, 5);
  });
});
