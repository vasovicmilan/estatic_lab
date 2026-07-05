import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createTestApp, closeTestApp, clearTestDatabase } from "../setup/test-app.js";
import { getCsrfToken } from "../../helpers/csrf.js";
import { registerAndLogin } from "../../helpers/session.js";
import { TINY_PNG, cleanupUploadedImage } from "../../helpers/upload.js";
import postRepo from "../../../src/repositories/post.repository.js";

describe("admin post CRUD + image upload (HTTP)", () => {
    let app;
    let uploadedImageUrls = [];

    before(async () => {
        app = await createTestApp();
    });

    after(async () => {
        await closeTestApp();
    });

    afterEach(async () => {
        await Promise.all(uploadedImageUrls.map(cleanupUploadedImage));
        uploadedImageUrls = [];
        await clearTestDatabase();
    });

    it("creates a post, defaulting the author to the logged-in admin", async () => {
        const agent = request.agent(app);
        const admin = await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
        const { token } = await getCsrfToken(agent, "/admin/blog/dodavanje");

        const res = await agent
            .post("/admin/blog")
            .field("CSRFToken", token)
            .field("title", "Kako Da Se Opustite")
            .field("excerpt", "Kratak opis posta o opustanju")
            .field("coverImageDesc", "Opustanje")
            .attach("coverImage", TINY_PNG, "test.png");

        assert.equal(res.status, 302);

        const result = await postRepo.findPosts({});
        assert.equal(result.data.length, 1);
        assert.equal(result.data[0].title, "Kako Da Se Opustite");
        assert.ok(result.data[0].slug);
        const rawPost = await postRepo.findPostById(result.data[0]._id, { populateFields: [] });
        assert.equal(String(rawPost.author), String(admin._id));
        assert.ok(result.data[0].coverImage?.img);

        uploadedImageUrls.push(result.data[0].coverImage.img);
    });

    it("rejects a post missing the required excerpt", async () => {
        const agent = request.agent(app);
        await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
        const { token } = await getCsrfToken(agent, "/admin/blog/dodavanje");

        const res = await agent
            .post("/admin/blog")
            .field("CSRFToken", token)
            .field("title", "Naslov Bez Opisa")
            .field("coverImageDesc", "Slika")
            .attach("coverImage", TINY_PNG, "test.png");

        assert.equal(res.status, 400);
        const result = await postRepo.findPosts({});
        assert.equal(result.data.length, 0);
    });

    it("accepts content sent as a JSON string", async () => {
        const agent = request.agent(app);
        await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });
        const { token } = await getCsrfToken(agent, "/admin/blog/dodavanje");

        const res = await agent
            .post("/admin/blog")
            .field("CSRFToken", token)
            .field("title", "Post Sa Sadrzajem")
            .field("excerpt", "Opis posta sa sadrzajem")
            .field("content", JSON.stringify([{ type: "paragraph", text: "Neki tekst", order: 0 }]))
            .field("coverImageDesc", "Slika")
            .attach("coverImage", TINY_PNG, "test.png");

        assert.equal(res.status, 302);

        const result = await postRepo.findPosts({});
        assert.equal(result.data.length, 1);
        assert.equal(result.data[0].content.length, 1);

        uploadedImageUrls.push(result.data[0].coverImage.img);
    });

    it("edits an existing post", async () => {
        const agent = request.agent(app);
        await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

        const { token: createToken } = await getCsrfToken(agent, "/admin/blog/dodavanje");
        await agent
            .post("/admin/blog")
            .field("CSRFToken", createToken)
            .field("title", "Original Naslov")
            .field("excerpt", "Original opis")
            .field("coverImageDesc", "Original slika")
            .attach("coverImage", TINY_PNG, "test.png");

        const existing = (await postRepo.findPosts({})).data[0];
        uploadedImageUrls.push(existing.coverImage.img);

        const { token: editToken } = await getCsrfToken(agent, `/admin/blog/izmena/${existing._id}`);
        const res = await agent
            .put(`/admin/blog/${existing._id}`)
            .field("CSRFToken", editToken)
            .field("title", "Izmenjeni Naslov")
            .field("excerpt", "Izmenjen opis");

        assert.equal(res.status, 302);
        const updated = await postRepo.findPostById(existing._id);
        assert.equal(updated.title, "Izmenjeni Naslov");
    });

    it("changes a post's status", async () => {
        const agent = request.agent(app);
        await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

        const { token: createToken } = await getCsrfToken(agent, "/admin/blog/dodavanje");
        await agent
            .post("/admin/blog")
            .field("CSRFToken", createToken)
            .field("title", "Draft Post")
            .field("excerpt", "Opis draft posta")
            .field("coverImageDesc", "Slika")
            .attach("coverImage", TINY_PNG, "test.png");

        const existing = (await postRepo.findPosts({})).data[0];
        uploadedImageUrls.push(existing.coverImage.img);

        const { token: statusToken } = await getCsrfToken(agent, `/admin/blog/izmena/${existing._id}`);
        const res = await agent
            .put(`/admin/blog/${existing._id}/status`)
            .type("form")
            .send({ CSRFToken: statusToken, status: "published" });

        assert.equal(res.status, 302);
        const updated = await postRepo.findPostById(existing._id);
        assert.equal(updated.status, "published");
    });

    it("deletes a post", async () => {
        const agent = request.agent(app);
        await registerAndLogin(agent, { email: "admin@example.com", roleName: "admin" });

        const { token: createToken } = await getCsrfToken(agent, "/admin/blog/dodavanje");
        await agent
            .post("/admin/blog")
            .field("CSRFToken", createToken)
            .field("title", "Za Brisanje")
            .field("excerpt", "Opis za brisanje")
            .field("coverImageDesc", "Slika")
            .attach("coverImage", TINY_PNG, "test.png");

        const existing = (await postRepo.findPosts({})).data[0];
        uploadedImageUrls.push(existing.coverImage.img);

        const { token: deleteToken } = await getCsrfToken(agent, "/admin/blog/dodavanje");
        const res = await agent.delete(`/admin/blog/${existing._id}`).set("X-CSRF-Token", deleteToken);

        assert.equal(res.status, 302);
        const found = await postRepo.findPostById(existing._id);
        assert.equal(found, null);
    });
});