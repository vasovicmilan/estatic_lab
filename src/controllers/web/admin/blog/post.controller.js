import * as postService from "../../../../services/post.service.js";
import * as categoryService from "../../../../services/category.service.js";
import * as tagService from "../../../../services/tag.service.js";
import * as userService from "../../../../services/user.service.js";
import {
  preparePostListData,
  preparePostDetailsData,
  preparePostFormData,
  preparePostSeoFormData,
} from "../../../../presenters/admin/blog/post.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

function parseJsonField(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function loadFormOptions() {
  const [categories, tags, authors] = await Promise.all([
    categoryService.getCategoriesForSelect("post"),
    tagService.getTagsForSelect("post"),
    userService.listUsers({ role: undefined, limit: 200 }),
  ]);

  return {
    categoryOptions: categories,
    tagOptions: tags,
    authorOptions: authors.data.map((u) => ({ value: u.id, label: u.imePrezime })),
  };
}

function buildPostPayload(req, existing = {}) {
  const data = { ...req.body };

  data.coverImage = req.uploadedFiles?.coverImage
    ? { img: req.uploadedFiles.coverImage.img, imgDesc: req.body.coverImageDesc || req.uploadedFiles.coverImage.imgDesc || "" }
    : existing.coverImage || null;

  data.gallery = req.uploadedFiles?.gallery
    ? req.uploadedFiles.gallery.map((f) => ({ img: f.img, imgDesc: f.imgDesc || "" }))
    : existing.gallery || [];

  data.content = parseJsonField(req.body.content, existing.content || []);
  data.categories = Array.isArray(req.body.categories) ? req.body.categories.filter(Boolean) : req.body.categories ? [req.body.categories] : [];
  data.tags = Array.isArray(req.body.tags) ? req.body.tags.filter(Boolean) : req.body.tags ? [req.body.tags] : [];
  data.seo = parseJsonField(req.body.seo, existing.seo || {});
  data.isIndexable = req.body.isIndexable === "true" || req.body.isIndexable === true || req.body.isIndexable === "on";

  return data;
}

export async function listPosts(req, res, next) {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    const result = await postService.listPosts({
      search: search || "",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = preparePostListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Blog",
      pageDescription: "Pregled svih blog objava",
      data: viewData,
    });
  } catch (error) {
    logError("[listPosts] Greška pri učitavanju liste blog objava", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function postDetails(req, res, next) {
  try {
    const { postId } = req.params;
    const post = await postService.getPostById(postId);
    const viewData = preparePostDetailsData(post);

    return res.render("admin/_details", {
      pageTitle: `Post — ${post.naslov}`,
      pageDescription: post.kratakOpis,
      data: viewData,
    });
  } catch (error) {
    logError("[postDetails] Greška pri učitavanju detalja posta", error, { postId: req.params.postId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function newPostForm(req, res, next) {
  try {
    const options = await loadFormOptions();
    const formData = preparePostFormData(null, options);
    return res.render("admin/_form", {
      pageTitle: "Novi post",
      pageDescription: "Kreiraj novu blog objavu",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[newPostForm] Greška pri prikazu forme za novi post", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editPostForm(req, res, next) {
  try {
    const { postId } = req.params;
    const post = await postService.getPostForEdit(postId);
    const options = await loadFormOptions();
    const formData = preparePostFormData(post, options);

    return res.render("admin/_form", {
      pageTitle: `Izmena — ${post.title}`,
      pageDescription: post.excerpt,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editPostForm] Greška pri učitavanju forme za izmenu posta", error, { postId: req.params.postId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function createPost(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[createPost] Validacione greške pri kreiranju posta", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const options = await loadFormOptions();
      const formData = preparePostFormData(null, options);
      return res.status(400).render("admin/_form", {
        pageTitle: "Novi post",
        pageDescription: "Kreiraj novu blog objavu",
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const data = buildPostPayload(req);
    data.author = data.author || req.session?.user?.id;

    const post = await postService.createPost(data);
    logInfo(`[createPost] Post kreiran: "${post.naslov}"`, { postId: post.id, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Post je uspešno kreiran", `/admin/blog/detalji/${post.id}`);
  } catch (error) {
    logError("[createPost] Greška pri kreiranju posta", error, { body: req.body, userId: req.session?.user?.id });
    
    if (error.statusCode === 400 || error.statusCode === 409) {
      const options = await loadFormOptions();
      const formData = preparePostFormData(null, options);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Novi post",
        pageDescription: "Kreiraj novu blog objavu",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updatePost(req, res, next) {
  try {
    const { postId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updatePost] Validacione greške za postId=${postId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const post = await postService.getPostForEdit(postId);
      const options = await loadFormOptions();
      const formData = preparePostFormData(post, options);
      return res.status(400).render("admin/_form", {
        pageTitle: `Izmena — ${post.title}`,
        pageDescription: post.excerpt,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await postService.getPostForEdit(postId);
    const data = buildPostPayload(req, existing);
    const updated = await postService.updatePostById(postId, data);
    logInfo(`[updatePost] Post #${postId} ažuriran`, { postId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Post je uspešno ažuriran", `/admin/blog/detalji/${updated.id}`);
  } catch (error) {
    logError("[updatePost] Greška pri ažuriranju posta", error, { postId: req.params.postId, body: req.body, userId: req.session?.user?.id });

    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 409) {
      const post = await postService.getPostForEdit(req.params.postId).catch(() => null);
      const options = await loadFormOptions();
      const formData = preparePostFormData(post, options);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: post ? `Izmena — ${post.title}` : "Izmena posta",
        pageDescription: post?.excerpt || "",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function updatePostStatus(req, res, next) {
  try {
    const { postId } = req.params;
    await postService.updatePostStatus(postId, req.body.status);
    logInfo(`[updatePostStatus] Status posta #${postId} promenjen na "${req.body.status}"`, { postId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Status posta je uspešno promenjen", `/admin/blog/detalji/${postId}`);
  } catch (error) {
    logError("[updatePostStatus] Greška pri promeni statusa posta", error, { postId: req.params.postId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/blog/detalji/${req.params.postId}`);
    }
    next(error);
  }
}

export async function editPostSeoForm(req, res, next) {
  try {
    const { postId } = req.params;
    const post = await postService.getPostById(postId);
    const formData = preparePostSeoFormData(post);

    return res.render("admin/post/seo", {
      pageTitle: `SEO — ${post.naslov}`,
      pageDescription: post.naslov,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[editPostSeoForm] Greška pri učitavanju SEO forme", error, { postId: req.params.postId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function updatePostSeo(req, res, next) {
  try {
    const { postId } = req.params;
    const seo = {
      title: req.body.seoTitle || "",
      description: req.body.seoDescription || "",
      keywords: Array.isArray(req.body.seoKeywords)
        ? req.body.seoKeywords.filter(Boolean)
        : (req.body.seoKeywords || "").split(",").map((k) => k.trim()).filter(Boolean),
    };

    const updated = await postService.updatePostSeo(postId, seo);
    logInfo(`[updatePostSeo] SEO posta #${postId} ažuriran`, { postId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "SEO podaci su uspešno ažurirani", `/admin/blog/detalji/${updated.id}`);
  } catch (error) {
    logError("[updatePostSeo] Greška pri ažuriranju SEO podataka", error, { postId: req.params.postId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/blog/detalji/${req.params.postId}`);
    }
    next(error);
  }
}

export async function deletePost(req, res, next) {
  try {
    const { postId } = req.params;
    await postService.deletePostById(postId);
    logInfo(`[deletePost] Post #${postId} obrisan`, { postId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Post je uspešno obrisan", "/admin/blog");
  } catch (error) {
    logError("[deletePost] Greška pri brisanju posta", error, { postId: req.params.postId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/blog");
    }
    next(error);
  }
}

export default {
  listPosts,
  postDetails,
  newPostForm,
  editPostForm,
  createPost,
  updatePost,
  updatePostStatus,
  editPostSeoForm,
  updatePostSeo,
  deletePost,
};
