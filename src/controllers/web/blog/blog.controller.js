import * as blogService from "../../../services/blog.service.js";
import {
  prepareBlogListData,
  prepareBlogCategoryData,
  prepareBlogTagData,
  prepareBlogPostData,
} from "../../../presenters/blog/blog.presenter.js";
import { generateSeo } from "../../../seo/index.js";
import { buildItemListJsonLd } from "../../../seo/utils.seo.js";
import { logError } from "../../../utils/logger.util.js";

export async function blogHome(req, res, next) {
  try {
    const { page = 1, search } = req.query;
    const data = await blogService.getBlogLandingData({ page: parseInt(page, 10) || 1, search: search || "" });
    const viewData = prepareBlogListData(data, { query: req.query, categories: data.categories, tags: data.tags, totalCount: data.totalCount });
    const itemList = buildItemListJsonLd(req, data.data.map((p) => ({ name: p.naslov, path: `/blog/${p.slug}` })));
    if (itemList) data.seo.jsonLd = [...(data.seo.jsonLd || []), itemList];

    return res.render("blog/blog", {
      pageTitle: data.seo.pageTitle,
      pageDescription: data.seo.pageDescription,
      seo: data.seo,
      data: viewData,
    });
  } catch (error) {
    logError("[blogHome] Greška pri učitavanju blog stranice", error, { page: req.query.page });
    next(error);
  }
}

export async function blogCategory(req, res, next) {
  try {
    const { categorySlug } = req.params;
    const { page = 1 } = req.query;

    const data = await blogService.getBlogCategoryData(categorySlug, { page: parseInt(page, 10) || 1 });
    const viewData = prepareBlogCategoryData(data.category, data, req.query, { categories: data.categories, tags: data.tags, totalCount: data.totalCount });
    const itemList = buildItemListJsonLd(req, data.data.map((p) => ({ name: p.naslov, path: `/blog/${p.slug}` })));
    if (itemList) data.seo.jsonLd = [...(data.seo.jsonLd || []), itemList];

    return res.render("blog/blog", {
      pageTitle: data.seo.pageTitle,
      pageDescription: data.seo.pageDescription,
      seo: data.seo,
      data: viewData,
    });
  } catch (error) {
    logError("[blogCategory] Greška pri učitavanju kategorije bloga", error, { categorySlug: req.params.categorySlug });
    next(error);
  }
}

export async function blogTag(req, res, next) {
  try {
    const { tagSlug } = req.params;
    const { page = 1 } = req.query;

    const data = await blogService.getBlogTagData(tagSlug, { page: parseInt(page, 10) || 1 });
    const viewData = prepareBlogTagData(data.tag, data, req.query, { categories: data.categories, tags: data.tags, totalCount: data.totalCount });
    const itemList = buildItemListJsonLd(req, data.data.map((p) => ({ name: p.naslov, path: `/blog/${p.slug}` })));
    if (itemList) data.seo.jsonLd = [...(data.seo.jsonLd || []), itemList];

    return res.render("blog/blog", {
      pageTitle: data.seo.pageTitle,
      pageDescription: data.seo.pageDescription,
      seo: data.seo,
      data: viewData,
    });
  } catch (error) {
    logError("[blogTag] Greška pri učitavanju taga bloga", error, { tagSlug: req.params.tagSlug });
    next(error);
  }
}

export async function postDetails(req, res, next) {
  try {
    const { slug } = req.params;
    const data = await blogService.getBlogPostData(slug);
    const seo = await generateSeo("post", data.post, req);
    const viewData = prepareBlogPostData(data.post, { relatedPosts: data.relatedPosts });

    return res.render("blog/post-details", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[postDetails] Greška pri učitavanju blog objave", error, { slug: req.params.slug });
    next(error);
  }
}

export async function searchBlog(req, res, next) {
  try {
    const { q, page = 1 } = req.query;
    if (!q) return res.redirect("/blog");

    const data = await blogService.searchBlogPosts(q, { page: parseInt(page, 10) || 1 });
    const viewData = prepareBlogListData(data, { query: { ...req.query, search: q }, categories: data.categories, tags: data.tags, totalCount: data.totalCount });

    // No ItemList here deliberately - this page is noindex (data.seo.robots), and
    // search-result listings aren't meaningful as a schema.org ItemList since the
    // set of results has no lasting identity to attach one to.
    return res.render("blog/blog", {
      pageTitle: data.seo.pageTitle,
      pageDescription: data.seo.pageDescription,
      seo: data.seo,
      data: viewData,
    });
  } catch (error) {
    logError("[searchBlog] Greška pri pretrazi bloga", error, { search: req.query.q });
    next(error);
  }
}

export default {
  blogHome,
  blogCategory,
  blogTag,
  postDetails,
  searchBlog,
};