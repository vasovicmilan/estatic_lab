import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildNewOrderMessage,
  buildOrderCancelledMessage,
  buildOrderStatusChangeMessage,
  buildStockAlertMessage,
  buildErrorAlertMessage,
} from "../../../src/utils/telegram-message.util.js";

describe("telegram-message.util - order/stock/error builders", () => {
  describe("buildNewOrderMessage", () => {
    it("includes the customer name, email, and total", () => {
      const msg = buildNewOrderMessage({ firstName: "Marko", lastName: "Markovic", email: "marko@example.com", total: "2350 RSD" });
      assert.match(msg, /Marko Markovic/);
      assert.match(msg, /marko@example\.com/);
      assert.match(msg, /2350 RSD/);
    });

    it("omits the phone line entirely when no phone is given", () => {
      const msg = buildNewOrderMessage({ firstName: "Marko", email: "marko@example.com" });
      assert.ok(!msg.includes("Telefon"));
    });

    it("includes the phone line when a phone is given", () => {
      const msg = buildNewOrderMessage({ firstName: "Marko", email: "marko@example.com", phone: "0601234567" });
      assert.match(msg, /0601234567/);
    });

    it("lists every item when items are present", () => {
      const msg = buildNewOrderMessage({ firstName: "Marko", email: "m@example.com", items: ["ESMA Uređaj x1", "Gel 200ml x2"] });
      assert.match(msg, /ESMA Uređaj x1/);
      assert.match(msg, /Gel 200ml x2/);
    });

    it("escapes HTML in user-provided fields (XSS safety - Telegram renders this as HTML)", () => {
      const msg = buildNewOrderMessage({ firstName: "<script>alert(1)</script>", email: "m@example.com" });
      assert.ok(!msg.includes("<script>"));
      assert.match(msg, /&lt;script&gt;/);
    });

    it("includes the admin link when adminUrl is given, omits it otherwise", () => {
      const withLink = buildNewOrderMessage({ firstName: "M", email: "m@example.com", adminUrl: "https://x.rs/admin/porudzbine/1" });
      assert.match(withLink, /https:\/\/x\.rs\/admin\/porudzbine\/1/);

      const withoutLink = buildNewOrderMessage({ firstName: "M", email: "m@example.com" });
      assert.ok(!withoutLink.includes("Otvori u adminu"));
    });
  });

  describe("buildOrderCancelledMessage", () => {
    it("reuses buildNewOrderMessage's content but swaps the header to 'cancelled'", () => {
      const msg = buildOrderCancelledMessage({ firstName: "Marko", email: "m@example.com", total: "1000 RSD" });
      assert.match(msg, /Porudžbina otkazana/);
      assert.ok(!msg.includes("Nova porudžbina potvrđena"));
      assert.match(msg, /1000 RSD/, "should still carry the order details through from the base message");
    });

    it("includes who cancelled it and the reason when provided", () => {
      const msg = buildOrderCancelledMessage({ firstName: "M", email: "m@example.com", cancelledBy: "Korisnik", cancelReason: "Predomislio se" });
      assert.match(msg, /Korisnik/);
      assert.match(msg, /Predomislio se/);
    });
  });

  describe("buildOrderStatusChangeMessage", () => {
    it("shows the old and new status with an arrow between them", () => {
      const msg = buildOrderStatusChangeMessage({ firstName: "Marko", total: "1000 RSD" }, "Na čekanju", "U obradi");
      assert.match(msg, /Na čekanju.*→.*U obradi/s);
    });

    it("escapes HTML in the status strings too, not just the customer name", () => {
      const msg = buildOrderStatusChangeMessage({ firstName: "M" }, "<b>x</b>", "ok");
      assert.ok(!msg.includes("<b>x</b>"));
    });
  });

  describe("buildStockAlertMessage", () => {
    it("uses the out-of-stock header and emoji when isOutOfStock is true", () => {
      const msg = buildStockAlertMessage({ productName: "ESMA", variantLabel: "Standard", stock: 0, isOutOfStock: true });
      assert.match(msg, /rasprodat/);
      assert.match(msg, /🔴/);
    });

    it("uses the low-stock header and emoji when isOutOfStock is false", () => {
      const msg = buildStockAlertMessage({ productName: "ESMA", variantLabel: "Standard", stock: 3, isOutOfStock: false });
      assert.match(msg, /Nisko stanje/);
      assert.match(msg, /🟡/);
    });

    it("shows the current stock count and variant label", () => {
      const msg = buildStockAlertMessage({ productName: "ESMA", variantLabel: "50ml", stock: 2, isOutOfStock: false });
      assert.match(msg, /50ml/);
      assert.match(msg, /Na stanju:.*2/s);
    });

    it("omits the SKU line when no SKU is given", () => {
      const msg = buildStockAlertMessage({ productName: "ESMA", variantLabel: "Standard", stock: 1, isOutOfStock: false });
      assert.ok(!msg.includes("SKU"));
    });
  });

  describe("buildErrorAlertMessage", () => {
    it("includes the error message itself", () => {
      const msg = buildErrorAlertMessage("Something broke");
      assert.match(msg, /Something broke/);
    });

    it("includes method+url, status code, environment, and error id when given", () => {
      const msg = buildErrorAlertMessage("Boom", { method: "POST", url: "/admin/kategorije", statusCode: 500, env: "production", errorId: "abc123" });
      assert.match(msg, /POST \/admin\/kategorije/);
      assert.match(msg, /500/);
      assert.match(msg, /production/);
      assert.match(msg, /abc123/);
    });

    it("dumps any extra context fields as a JSON blob at the end", () => {
      const msg = buildErrorAlertMessage("Boom", { userId: "u1", extra: "data" });
      assert.match(msg, /"userId":"u1"/);
    });

    it("escapes the error message itself against HTML injection", () => {
      const msg = buildErrorAlertMessage("<img src=x onerror=alert(1)>");
      assert.ok(!msg.includes("<img"));
    });
  });
});