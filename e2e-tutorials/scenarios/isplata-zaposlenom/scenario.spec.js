import { test, expect, newRecordedContext, typeSlowly } from "../../scripts/tutorial.fixture.js";
import { connectDb, disconnectDb } from "../../../test/e2e/helpers/db.js";
import { loginViaUISlowly, seedAdminUser, enterAdminPanel, navigateAdminViaMenu } from "../../scripts/slow-actions.js";
import { seedEmployee, seedCommissionEntry, confirmActionModal, expectFlashSuccess } from "../../../test/e2e/helpers/e2e-helpers.js";
import PayoutRequest from "../../../src/models/payout-request.model.js";

/**
 * Tutorial scenario, not a regression test - adapted from payout-cycle.spec.js's
 * main case (employee side; partner payout works identically through their own
 * separate /moj-partner-nalog dashboard - not re-narrated here to avoid telling
 * the same story twice). Worth showing because it closes the loop the OTHER
 * commission tutorials open: earning a commission isn't the same as being able
 * to withdraw it - this is the actual request -> approve -> paid mechanism, and
 * the remaining-balance guard that stops someone from requesting more than
 * they've actually earned minus what's already pending.
 */
test.describe("Tutorial: isplata zaposlenom", () => {
  test.beforeAll(async () => {
    await connectDb();
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("zaposleni traži isplatu, admin je odobrava pa označava kao isplaćenu", async ({ page, browser, tut }) => {
    test.slow();

    const { user: employeeUser, employee } = await seedEmployee({ commissionRate: 20 });
    await seedCommissionEntry({ earnerType: "employee", employee, amount: 3000, rate: 20 });

    await tut.step("prijava-zaposlenog", async () => {
      await loginViaUISlowly(page, { email: employeeUser.email });
    });

    await tut.step("pregled-stanja", async () => {
      await page.goto("/moj-nalog");
      await expect(page.getByText("3000").first()).toBeVisible();
    });

    await tut.step("zahtev-za-isplatu", async () => {
      await typeSlowly(page.locator('input[name="amount"]'), "2000");
      await page.getByRole("button", { name: "Pošalji zahtev" }).click();
      await expectFlashSuccess(page);
    });

    const request = await PayoutRequest.findOne({ employee: employee._id }).sort({ createdAt: -1 });
    expect(request.status).toBe("requested");
    expect(request.amount).toBe(2000);

    await tut.step("preostalo-stanje", async () => {
      // 3000 zarađeno - 2000 sad rezervisano zahtevom iznad = 1000 preostalo.
      // Forma sama ograničava na taj iznos (max atribut) - browser to sprečava
      // pre nego što bi zahtev uopšte stigao do servera.
      await page.goto("/moj-nalog");
      await expect(page.locator('input[name="amount"]')).toHaveAttribute("max", "1000");
    });

    // --- admin: odobrava pa označava kao isplaćeno ---
    const adminEmail = `tutorial-payout-admin-${Date.now()}@example.com`;
    await seedAdminUser({ email: adminEmail, firstName: "Admin", lastName: "Nalog" });

    const { context: adminContext, finalize: finalizeAdminVideo, video: adminVideo } = await newRecordedContext(browser, "isplata-zaposlenom", "admin-flow");
    const adminPage = await adminContext.newPage();

    await tut.step("admin-prijava", async () => {
      await loginViaUISlowly(adminPage, { email: adminEmail });
    }, { page: adminPage, video: adminVideo });

    await enterAdminPanel(adminPage, tut, adminVideo, { stepIdPrefix: "admin-ulazak" });
    await navigateAdminViaMenu(adminPage, tut, adminVideo, { groupLabel: "Partnerski program", itemLabel: "Isplate", stepIdPrefix: "admin-isplate" });

    await tut.step("admin-otvara-zahtev", async () => {
      // isplate nema polje za pretragu (videti payout-request.filter.js) - u
      // svežem test okruženju je ovo jedini zahtev na listi, pa se otvara
      // direktno iz reda tabele
      await adminPage.locator('a[title="Detalji"]').first().click();
      await expect(adminPage.getByRole("button", { name: "Odobri" })).toBeVisible();
    }, { page: adminPage, video: adminVideo });

    await tut.step("admin-odobrava", async () => {
      await adminPage.getByRole("button", { name: "Odobri" }).click();
      await confirmActionModal(adminPage);
      await expectFlashSuccess(adminPage);
    }, { page: adminPage, video: adminVideo });

    const approved = await PayoutRequest.findById(request._id);
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeTruthy();

    await tut.step("admin-oznacava-isplaceno", async () => {
      await adminPage.getByRole("button", { name: "Označi kao isplaćeno" }).click();
      await confirmActionModal(adminPage);
      await expectFlashSuccess(adminPage);
    }, { page: adminPage, video: adminVideo });

    const paid = await PayoutRequest.findById(request._id);
    expect(paid.status).toBe("paid");
    expect(paid.paidAt).toBeTruthy();

    await tut.step("istorija-isplata", async () => {
      // "Isplaćeno" se prikazuje i kao <option> u filteru statusa i kao skriven
      // mobilni-kartica duplikat (videti payouts.ejs) - table cell role pogađa
      // samo vidljivi desktop red
      await page.goto("/moj-nalog/isplate");
      await expect(page.getByRole("cell", { name: "Isplaćeno" })).toBeVisible();
    });

    await finalizeAdminVideo();
  });
});
