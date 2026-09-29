import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { id } from "../../helpers/factories.js";
import siteContentService from "../../../src/services/site-content.service.js";
import packageRepo from "../../../src/repositories/package.repository.js";

describe("admin site content - web pages (HTTP)", () => {
  let app;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await closeTestApp();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  it("lists all editable sections for an admin", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const res = await agent.get("/admin/sajt/sadrzaj");

    assert.equal(res.status, 200);
    for (const slug of ["o-nama", "faq", "politika-privatnosti", "uslovi-koriscenja", "partnerski-program", "pocetna-uvod", "zasto-mi", "tim-uvod"]) {
      assert.ok(res.text.includes(`/admin/sajt/sadrzaj/${slug}`), slug);
    }
  });

  it("blocks a non-admin (no manage_site_content permission) with a 403", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "kupac@example.com", roleName: "user" });

    assert.equal((await agent.get("/admin/sajt/sadrzaj")).status, 403);
    assert.equal((await agent.get("/admin/sajt/sadrzaj/faq")).status, 403);
  });

  it("renders an edit form for a section and 404s for an unknown one", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

    const ok = await agent.get("/admin/sajt/sadrzaj/o-nama");
    assert.equal(ok.status, 200);
    assert.match(ok.text, /data-sc-sections/);

    assert.equal((await agent.get("/admin/sajt/sadrzaj/ne-postoji")).status, 404);
  });

  it("saves the FAQ from the web form and shows it through the same service the public page and API use", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const { token } = await getCsrfToken(agent, "/admin/sajt/sadrzaj/faq");

    const res = await agent
      .put("/admin/sajt/sadrzaj/faq")
      .type("form")
      .send({ CSRFToken: token, items: JSON.stringify([{ pitanje: "Radite li nedeljom?", odgovor: "Ne." }, { pitanje: "", odgovor: "" }]) });

    assert.equal(res.status, 302);
    const faq = await siteContentService.getFaq();
    assert.equal(faq.items.length, 1);
    assert.equal(faq.items[0].pitanje, "Radite li nedeljom?");
  });

  it("re-renders with a 400 and keeps the stored content when validation fails", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const before = await siteContentService.getAbout();
    const { token } = await getCsrfToken(agent, "/admin/sajt/sadrzaj/o-nama");

    const res = await agent.put("/admin/sajt/sadrzaj/o-nama").type("form").send({ CSRFToken: token, intro: "", sections: "[]" });

    assert.equal(res.status, 400);
    assert.match(res.text, /obavezno/);
    assert.equal((await siteContentService.getAbout()).intro, before.intro);
  });
});

describe("admin package SEO page (HTTP)", () => {
  let app;

  before(async () => {
    app = await createTestApp();
  });

  after(async () => {
    await closeTestApp();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  async function createPackageFixture() {
    return packageRepo.createPackage({
      name: "Dan za sebe",
      slug: "dan-za-sebe",
      description: "Kombinovani paket",
      items: [{ service: id(), servicePackageId: id(), sessions: 1 }],
      totalPrice: 8000,
      seoKeywords: ["stara"],
    });
  }

  it("shows the current keywords and saves new ones from the generic form's seoKeywordsCsv field", async () => {
    const agent = request.agent(app);
    await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
    const pkg = await createPackageFixture();

    const { token, response } = await getCsrfToken(agent, `/admin/paketi/${pkg._id}/seo`);
    assert.equal(response.status, 200);
    assert.match(response.text, /stara/);

    const res = await agent.put(`/admin/paketi/${pkg._id}/seo`).type("form").send({ CSRFToken: token, seoKeywordsCsv: "spa, masaža, spa" });

    assert.equal(res.status, 302);
    const updated = await packageRepo.findPackageById(pkg._id);
    assert.deepEqual([...updated.seoKeywords], ["spa", "masaža"]);
  });
});
