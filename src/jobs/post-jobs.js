import postRepo from "../repositories/post.repository.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

// Same shape as report-jobs.js/commission-jobs.js's runJob: do the work, log
// success, and on failure both log AND alert - a cron silently failing every
// few minutes is exactly the kind of thing that goes unnoticed for weeks,
// and this one is the whole point of the scheduling feature (a "scheduled"
// post that never flips to "published" just sits invisible on the site).
async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

export async function runPublishScheduledPosts() {
  return runJob("publish-scheduled-posts", async () => {
    const duePosts = await postRepo.findDueScheduledPosts();
    if (duePosts.length === 0) return;

    let published = 0;
    for (const post of duePosts) {
      try {
        post.status = "published";
        // .save() (not a bulk update) is deliberate - it's what triggers
        // post.model.js's pre("save") hook, which sets publishedAt. See the
        // comment on findDueScheduledPosts in post.repository.js.
        await post.save();
        published += 1;
      } catch (error) {
        // one bad post (e.g. failed a validator on save) shouldn't block the
        // rest of the batch from publishing on schedule
        logError(`[cron] publish-scheduled-posts failed for post ${post._id}`, error, { postId: post._id.toString() });
      }
    }

    if (published > 0) {
      logInfo(`[cron] Published ${published} of ${duePosts.length} due post(s)`);
    }
  });
}

export default { runPublishScheduledPosts };