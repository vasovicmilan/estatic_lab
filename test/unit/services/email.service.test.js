import { describe, it } from "node:test";
import assert from "node:assert/strict";
import emailProvider from "../../../src/integrations/email/email.provider.js";
import emailService from "../../../src/services/email.service.js";

/**
 * Renders every template for real (renderTemplate does a plain file read +
 * ejs.render, no DB/network) and only mocks the actual network-sending call
 * (emailProvider.sendEmail) - catches real template bugs, not just
 * service-layer logic.
 *
 * BUG FIX regression coverage - see sendAccountConfirmationEmail's own
 * comment in email.service.js. The confirmation link had a stray "/auth"
 * prefix no route actually has (auth.routes.js mounts everything at root),
 * so every single registration's confirmation email 404d, unconditionally -
 * this file had zero test coverage before, which is exactly how a one-line,
 * always-broken link survived undetected. Also why email.provider.js's
 * sendEmail is now default-exported too - a plain named export's module
 * namespace object isn't mockable (its properties aren't configurable per
 * the ESM spec), which is exactly what made this file untestable before.
 */
describe("email.service", () => {
  describe("sendAccountConfirmationEmail", () => {
    it("builds the confirmation link WITHOUT an /auth prefix - matching auth.routes.js's real root-mounted /verifikacija/:token", async (t) => {
      let capturedHtml;
      const sendMock = t.mock.method(emailProvider, "sendEmail", async ({ html }) => {
        capturedHtml = html;
        return { messageId: "test" };
      });

      await emailService.sendAccountConfirmationEmail({ email: "test@example.com", firstName: "Ana" }, "abc123token");

      assert.equal(sendMock.mock.calls.length, 1);
      assert.ok(capturedHtml.includes("/verifikacija/abc123token"), "must link to the real route");
      assert.ok(!capturedHtml.includes("/auth/verifikacija"), "must NOT contain the old, nonexistent /auth-prefixed path");
    });
  });

  describe("every other link this file builds", () => {
    // Cross-checked each of these against its real route definition when
    // investigating the confirmation-link bug above - confirmationUrl was
    // the only one out of sync. Locked in here so a future route-prefix
    // change (the exact kind of edit that caused the original bug) gets
    // caught immediately instead of silently drifting again.
    it("resetUrl for claiming a guest account matches /preuzmi-nalog/:token", async (t) => {
      let capturedHtml;
      t.mock.method(emailProvider, "sendEmail", async ({ html }) => {
        capturedHtml = html;
        return {};
      });
      await emailService.sendClaimAccountEmail({ email: "test@example.com", firstName: "Ana" }, "reset-tok");
      assert.ok(capturedHtml.includes("/preuzmi-nalog/reset-tok"));
    });

    it("resetUrl for password reset matches /resetovanje-lozinke/:token", async (t) => {
      let capturedHtml;
      t.mock.method(emailProvider, "sendEmail", async ({ html }) => {
        capturedHtml = html;
        return {};
      });
      await emailService.sendPasswordResetEmail({ email: "test@example.com", firstName: "Ana" }, "reset-tok");
      assert.ok(capturedHtml.includes("/resetovanje-lozinke/reset-tok"));
    });
  });
});
