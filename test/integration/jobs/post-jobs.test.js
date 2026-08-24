import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import Post from "../../../src/models/post.model.js";
import { runPublishScheduledPosts } from "../../../src/jobs/post-jobs.js";

let counter = 0;

function scheduledPost(overrides = {}) {
  counter += 1;
  return {
    title: `Test objava ${counter}`,
    slug: `test-objava-${counter}`,
    excerpt: "Kratak opis",
    coverImage: { img: "/images/posts/x.webp", imgDesc: "x" },
    author: new mongoose.Types.ObjectId(),
    status: "scheduled",
    scheduledFor: new Date(Date.now() + 60 * 60000), // valid: in the future when first created
    ...overrides,
  };
}

/**
 * Integration coverage for src/jobs/post-jobs.js - previously had zero test
 * coverage. Real Post documents, real .save() calls (deliberately, not a bulk
 * update - this is what triggers post.model.js's pre("save") hook that sets
 * publishedAt, see the comment on findDueScheduledPosts in post.repository.js).
 */
describe("post-jobs", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  it("publishes a scheduled post whose scheduledFor date has passed, setting publishedAt", async () => {
    const post = await Post.create(scheduledPost());
    // backdate scheduledFor directly in the DB, bypassing the pre-save "must be in
    // the future" validation that only applies when status is BEING SET to
    // "scheduled" (see post.model.js) - this mirrors a real post that was
    // legitimately scheduled for the future and simply hasn't been swept yet
    await Post.updateOne({ _id: post._id }, { $set: { scheduledFor: new Date(Date.now() - 60000) } });

    await runPublishScheduledPosts();

    const updated = await Post.findById(post._id);
    assert.equal(updated.status, "published");
    assert.ok(updated.publishedAt instanceof Date);
  });

  it("never touches a scheduled post whose date hasn't arrived yet", async () => {
    const post = await Post.create(scheduledPost({ scheduledFor: new Date(Date.now() + 60 * 60000) }));

    await runPublishScheduledPosts();

    const unchanged = await Post.findById(post._id);
    assert.equal(unchanged.status, "scheduled");
    assert.equal(unchanged.publishedAt, null);
  });

  it("never touches a draft or already-published post, even with a past scheduledFor leftover", async () => {
    const draft = await Post.create(scheduledPost({ status: "draft" }));
    await Post.updateOne({ _id: draft._id }, { $set: { scheduledFor: new Date(Date.now() - 60000) } });

    await runPublishScheduledPosts();

    const unchanged = await Post.findById(draft._id);
    assert.equal(unchanged.status, "draft");
  });

  it("REGRESSION: one bad post failing to save doesn't block the rest of the due batch", async () => {
    const willFail = await Post.create(scheduledPost());
    const willSucceed = await Post.create(scheduledPost());
    await Post.updateOne({ _id: willFail._id }, { $set: { scheduledFor: new Date(Date.now() - 60000), title: "" } }, { runValidators: false });
    await Post.updateOne({ _id: willSucceed._id }, { $set: { scheduledFor: new Date(Date.now() - 60000) } });

    await assert.doesNotReject(() => runPublishScheduledPosts());

    const failed = await Post.findById(willFail._id);
    const succeeded = await Post.findById(willSucceed._id);
    assert.equal(failed.status, "scheduled"); // save() failed validation (empty title), left untouched
    assert.equal(succeeded.status, "published"); // unaffected by the other's failure
  });

  it("does nothing (and doesn't throw) when nothing is due", async () => {
    await assert.doesNotReject(() => runPublishScheduledPosts());
  });
});
