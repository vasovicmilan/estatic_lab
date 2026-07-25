import { describe, it } from "node:test";
import assert from "node:assert/strict";
import TELEGRAM_CONFIG from "../../../src/integrations/telegram/telegram.config.js";
import telegramProvider from "../../../src/integrations/telegram/telegram.provider.js";
import * as telegramService from "../../../src/services/telegram.service.js";

describe("telegram.service", () => {
  describe("sendTelegramMessage - graceful degradation contract", () => {
    it("returns null without touching the bot when Telegram is disabled", async (t) => {
      t.mock.method(TELEGRAM_CONFIG, "isEnabled", () => false);
      const botMock = t.mock.method(telegramProvider, "getTelegramBot", () => {
        throw new Error("should never be called when disabled");
      });

      const result = await telegramService.sendTelegramMessage("new_appointment", "Test poruka");

      assert.equal(result, null);
      assert.equal(botMock.mock.calls.length, 0);
    });

    it("returns null (not throw) when the bot failed to initialize", async (t) => {
      t.mock.method(TELEGRAM_CONFIG, "isEnabled", () => true);
      t.mock.method(telegramProvider, "getTelegramBot", () => null);

      const result = await telegramService.sendTelegramMessage("new_appointment", "Test poruka");

      assert.equal(result, null);
    });

    it("returns null when no chat ID is configured", async (t) => {
      t.mock.method(TELEGRAM_CONFIG, "isEnabled", () => true);
      t.mock.method(telegramProvider, "getTelegramBot", () => ({ telegram: { sendMessage: async () => {} } }));
      t.mock.method(TELEGRAM_CONFIG, "getChatId", () => null);

      const result = await telegramService.sendTelegramMessage("new_appointment", "Test poruka");

      assert.equal(result, null);
    });

    it("sends successfully and returns the API result when everything is configured", async (t) => {
      t.mock.method(TELEGRAM_CONFIG, "isEnabled", () => true);
      t.mock.method(TELEGRAM_CONFIG, "getChatId", () => "chat-123");
      t.mock.method(TELEGRAM_CONFIG, "getThreadId", () => null);
      let capturedArgs;
      t.mock.method(telegramProvider, "getTelegramBot", () => ({
        telegram: {
          sendMessage: async (chatId, text, options) => {
            capturedArgs = { chatId, text, options };
            return { message_id: 42 };
          },
        },
      }));

      const result = await telegramService.sendTelegramMessage("new_appointment", "Novi termin je zakazan");

      assert.equal(result.message_id, 42);
      assert.equal(capturedArgs.chatId, "chat-123");
      assert.equal(capturedArgs.text, "Novi termin je zakazan");
      assert.equal(capturedArgs.options.parse_mode, "HTML");
    });

    it("includes message_thread_id only when a thread id is configured for this message type", async (t) => {
      t.mock.method(TELEGRAM_CONFIG, "isEnabled", () => true);
      t.mock.method(TELEGRAM_CONFIG, "getChatId", () => "chat-123");
      t.mock.method(TELEGRAM_CONFIG, "getThreadId", () => 55);
      let capturedOptions;
      t.mock.method(telegramProvider, "getTelegramBot", () => ({
        telegram: {
          sendMessage: async (chatId, text, options) => {
            capturedOptions = options;
            return { message_id: 1 };
          },
        },
      }));

      await telegramService.sendTelegramMessage("new_order", "Nova porudžbina");

      assert.equal(capturedOptions.message_thread_id, 55);
    });

    it("returns null instead of throwing when the Telegram API call itself fails", async (t) => {
      t.mock.method(TELEGRAM_CONFIG, "isEnabled", () => true);
      t.mock.method(TELEGRAM_CONFIG, "getChatId", () => "chat-123");
      t.mock.method(TELEGRAM_CONFIG, "getThreadId", () => null);
      t.mock.method(telegramProvider, "getTelegramBot", () => ({
        telegram: {
          sendMessage: async () => {
            throw new Error("Telegram API is down");
          },
        },
      }));

      // should NOT throw - a failed notification must never break the real
      // action (e.g. a booking) that triggered it
      const result = await telegramService.sendTelegramMessage("new_appointment", "Test poruka");

      assert.equal(result, null);
    });

    it("lets caller-supplied options override the default parse_mode", async (t) => {
      t.mock.method(TELEGRAM_CONFIG, "isEnabled", () => true);
      t.mock.method(TELEGRAM_CONFIG, "getChatId", () => "chat-123");
      t.mock.method(TELEGRAM_CONFIG, "getThreadId", () => null);
      let capturedOptions;
      t.mock.method(telegramProvider, "getTelegramBot", () => ({
        telegram: {
          sendMessage: async (chatId, text, options) => {
            capturedOptions = options;
            return { message_id: 1 };
          },
        },
      }));

      await telegramService.sendTelegramMessage("new_appointment", "Test", { parse_mode: "MarkdownV2" });

      assert.equal(capturedOptions.parse_mode, "MarkdownV2");
    });
  });
});