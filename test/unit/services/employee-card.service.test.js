import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import cardRepo from "../../../src/repositories/employee-card.repository.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import materialRepo from "../../../src/repositories/material.repository.js";
import productRepo from "../../../src/repositories/product.repository.js";
import * as cardService from "../../../src/services/employee-card.service.js";
import { id } from "../../helpers/factories.js";

const ids = { p1: id(), p2: id(), p3: id(), pOff: id(), employee: id(), cat1: id(), cat2: id(), s1: id(), s2: id(), s3: id(), s4: id(), foreignCat: id(), foreignSvc: id() };

function employeeFixture() {
  const cat = (oid, name) => ({ _id: oid, name, slug: name });
  const svc = (oid, name, cats) => ({ _id: oid, name, slug: name.toLowerCase(), isActive: true, categories: cats });
  return {
    _id: ids.employee,
    isActive: true,
    userId: { firstName: "Ana", lastName: "Petrović", email: "ana@estetik.rs", phone: "+381601112233" },
    expert: null,
    services: [
      svc(ids.s1, "Masaža", [cat(ids.cat1, "Masaže")]),
      svc(ids.s2, "Lica", [cat(ids.cat2, "Tretmani lica")]),
      svc(ids.s3, "Piling", [cat(ids.cat2, "Tretmani lica")]),
      svc(ids.s4, "Manikir", [cat(ids.cat2, "Tretmani lica")]),
    ],
  };
}

let stored;
let created;
let updated;
let counters;

beforeEach(() => {
  stored = null;
  created = null;
  updated = null;
  counters = [];
  employeeRepo.findEmployeeById = async () => employeeFixture();
  materialRepo.findActiveMaterialOptions = async () => [];
  const products = [
    { _id: ids.p1, name: "Aparat A", slug: "aparat-a", isActive: true },
    { _id: ids.p2, name: "Aparat B", slug: "aparat-b", isActive: true },
    { _id: ids.p3, name: "Aparat C", slug: "aparat-c", isActive: true },
    { _id: ids.pOff, name: "Ugašen", slug: "ugasen", isActive: false },
  ];
  productRepo.findProducts = async () => ({ data: products.filter((p) => p.isActive) });
  productRepo.findProductsByIds = async (list) => products.filter((p) => list.map(String).includes(String(p._id)));
  cardRepo.findCardByEmployee = async () => stored;
  cardRepo.findCardBySlug = async () => stored;
  cardRepo.slugExists = async () => false;
  cardRepo.createCard = async (data) => {
    created = data;
    return { _id: id(), ...data };
  };
  cardRepo.updateCardById = async (_id, data) => {
    updated = data;
    return { _id, ...data };
  };
  cardRepo.incrementCounter = async (_id, field) => counters.push(field);
});

describe("employee-card.service saveCard", () => {
  it("creates a private card with a short random slug and defaults", async () => {
    await cardService.saveCard(ids.employee, { displayName: "", isPublic: false });
    assert.match(created.slug, /^[a-z2-9]{8}$/);
    assert.equal(created.isPublic, false);
    assert.equal(created.displayName, "Ana Petrović");
    assert.deepEqual(created.show, { phone: false, email: false, bio: false, instagram: false, facebook: false, website: false, services: false, products: false });
  });

  it("keeps only the employee's own categories and services (no foreign ids)", async () => {
    await cardService.saveCard(ids.employee, {
      categories: [String(ids.cat1), String(ids.foreignCat)],
      pinnedServices: [String(ids.s1), String(ids.foreignSvc)],
    });
    assert.deepEqual(created.categories.map(String), [String(ids.cat1)]);
    assert.deepEqual(created.pinnedServices.map(String), [String(ids.s1)]);
  });

  it("refuses more than 3 pinned services", async () => {
    await assert.rejects(
      () => cardService.saveCard(ids.employee, { pinnedServices: [ids.s1, ids.s2, ids.s3, ids.s4].map(String) }),
      (e) => e.statusCode === 400
    );
  });

  it("normalizes social links and drops unsafe ones", async () => {
    await cardService.saveCard(ids.employee, { instagram: "@ana", website: "javascript:alert(1)" });
    assert.equal(created.instagram, "https://instagram.com/ana");
    assert.equal(created.website, "");
  });

  it("an existing card is updated and keeps its slug", async () => {
    stored = { _id: id(), slug: "abcd2345", employee: ids.employee, photo: null };
    await cardService.saveCard(ids.employee, { isPublic: true });
    assert.equal(created, null);
    assert.equal(updated.isPublic, true);
    assert.equal("slug" in updated, false);
  });
});

describe("employee-card.service getPublicCard", () => {
  const publicCard = (overrides = {}) => ({
    _id: id(),
    employee: ids.employee,
    slug: "abcd2345",
    isPublic: true,
    adminDisabled: false,
    displayName: "Ana P.",
    title: "Kozmetičar",
    bio: "Tajni opis",
    show: { phone: false, email: false, bio: false, instagram: false, facebook: false, website: false, services: false, products: false },
    instagram: "https://instagram.com/ana",
    categories: [],
    pinnedServices: [],
    material: null,
    ...overrides,
  });

  it("shows nothing personal by default - only name and title", async () => {
    stored = publicCard();
    const view = await cardService.getPublicCard("abcd2345");
    assert.equal(view.name, "Ana P.");
    assert.equal(view.phone, null);
    assert.equal(view.email, null);
    assert.equal(view.bio, "");
    assert.equal(view.instagram, null);
    assert.equal(view.hasServices, false);
    assert.deepEqual(counters, ["viewCount"]);
  });

  it("shows exactly what was ticked", async () => {
    stored = publicCard({ show: { ...publicCard().show, phone: true, bio: true, instagram: true } });
    const view = await cardService.getPublicCard("abcd2345");
    assert.equal(view.phone, "+381601112233");
    assert.equal(view.bio, "Tajni opis");
    assert.equal(view.instagram, "https://instagram.com/ana");
    assert.equal(view.email, null);
  });

  it("groups services by the chosen categories, pinned first, booking links carry the employee", async () => {
    stored = publicCard({ show: { ...publicCard().show, services: true }, categories: [ids.cat2], pinnedServices: [ids.s3] });
    const view = await cardService.getPublicCard("abcd2345");
    assert.deepEqual(view.pinned.map((s) => s.name), ["Piling"]);
    assert.equal(view.groups.length, 1);
    assert.equal(view.groups[0].name, "Tretmani lica");
    assert.deepEqual(view.groups[0].services.map((s) => s.name), ["Lica", "Manikir"]);
    assert.equal(view.pinned[0].url, `/zakazivanje/piling?employeeId=${ids.employee}`);
  });

  it("does not list services of categories that were not chosen", async () => {
    stored = publicCard({ show: { ...publicCard().show, services: true }, categories: [ids.cat1] });
    const view = await cardService.getPublicCard("abcd2345");
    assert.deepEqual(view.groups.map((g) => g.name), ["Masaže"]);
  });

  it("404 when not public, admin-disabled or unknown", async () => {
    for (const card of [publicCard({ isPublic: false }), publicCard({ adminDisabled: true }), null]) {
      stored = card;
      await assert.rejects(() => cardService.getPublicCard("abcd2345"), (e) => e.statusCode === 404);
    }
  });

  it("vCard contains phone/email only when ticked and counts the download", async () => {
    stored = publicCard({ show: { ...publicCard().show, phone: true } });
    const { text, fileName } = await cardService.getVCard("abcd2345");
    assert.ok(text.includes("TEL;TYPE=CELL:+381601112233"));
    assert.ok(!text.includes("EMAIL"));
    assert.equal(fileName, "ana-p.vcf");
    assert.deepEqual(counters, ["contactDownloadCount"]);
  });
});

describe("employee-card.service artikli prodavnice", () => {
  it("čuva samo aktivne postojeće artikle, bez duplikata", async () => {
    await cardService.saveCard(ids.employee, { pinnedProducts: [ids.p1, ids.p1, ids.pOff, id()], show: { products: true } });
    assert.deepEqual(created.pinnedProducts.map(String), [String(ids.p1)]);
    assert.equal(created.show.products, true);
  });

  it("odbija više od 6 artikala", async () => {
    await assert.rejects(() => cardService.saveCard(ids.employee, { pinnedProducts: [1, 2, 3, 4, 5, 6, 7].map(() => id()) }), /najviše 6/);
  });

  it("javna vizitka prikazuje artikle izabranim redosledom, linkovi su bez koda, neaktivni se preskaču", async () => {
    stored = {
      _id: id(), employee: ids.employee, slug: "abcd2345", isPublic: true, adminDisabled: false, displayName: "Ana P.",
      show: { products: true }, categories: [], pinnedServices: [], pinnedProducts: [ids.p2, ids.pOff, ids.p1], material: null,
    };
    const view = await cardService.getPublicCard("abcd2345");
    assert.equal(view.hasProducts, true);
    assert.deepEqual(view.products, [
      { name: "Aparat B", url: "/prodavnica/aparat-b" },
      { name: "Aparat A", url: "/prodavnica/aparat-a" },
    ]);
    assert.ok(view.products.every((p) => !p.url.includes("code=")));
  });

  it("ne prikazuje artikle ako nisu uključeni", async () => {
    stored = {
      _id: id(), employee: ids.employee, slug: "abcd2345", isPublic: true, adminDisabled: false, displayName: "Ana P.",
      show: { products: false }, categories: [], pinnedServices: [], pinnedProducts: [ids.p1], material: null,
    };
    const view = await cardService.getPublicCard("abcd2345");
    assert.equal(view.hasProducts, false);
    assert.deepEqual(view.products, []);
  });
});
