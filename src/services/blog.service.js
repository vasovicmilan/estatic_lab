import postService from "./post.service.js";
import categoryService from "./category.service.js";
import tagService from "./tag.service.js";
import { buildPageSeo } from "../seo/index.js";
import { validationError } from "../utils/error.util.js";

export async function getBlogLandingData({ limit = 9, page = 1, search = "" } = {}) {
  const [posts, categories, tags] = await Promise.all([
    postService.findPublishedPosts({ limit, page, search }),
    categoryService.getPublicCategories("post"),
    tagService.getPublicTags("post"),
  ]);

  const seo = buildPageSeo({
    title: "Blog | Estatik Lab",
    description: "Saveti o nezi, wellness rutinama i tretmanima — pratite Estatik Lab blog.",
    canonical: "/blog",
    isIndexable: true,
  });

  return { ...posts, categories, tags, seo };
}

export async function getBlogCategoryData(categorySlug, { limit = 9, page = 1 } = {}) {
  if (!categorySlug) validationError("categorySlug");

  const [category, categories, tags] = await Promise.all([
    categoryService.getCategoryBySlugAndDomain(categorySlug, "post"),
    categoryService.getPublicCategories("post"),
    tagService.getPublicTags("post"),
  ]);
  const posts = await postService.findPublishedPosts({ limit, page, filters: { category: category._id } });

  const seo = buildPageSeo({
    title: `${category.name} | Blog | Estatik Lab`,
    description: category.shortDescription || `Pročitajte sve blog objave iz kategorije ${category.name}.`,
    canonical: `/blog/kategorija/${category.slug}`,
    isIndexable: true,
  });

  return {
    ...posts,
    category: { id: category._id.toString(), naziv: category.name, slug: category.slug },
    categories,
    tags,
    seo,
  };
}

export async function getBlogTagData(tagSlug, { limit = 9, page = 1 } = {}) {
  if (!tagSlug) validationError("tagSlug");

  const [tag, categories, tags] = await Promise.all([
    tagService.getTagBySlugAndDomain(tagSlug, "post"),
    categoryService.getPublicCategories("post"),
    tagService.getPublicTags("post"),
  ]);
  const posts = await postService.findPublishedPosts({ limit, page, filters: { tag: tag._id } });

  const seo = buildPageSeo({
    title: `#${tag.name} | Blog | Estatik Lab`,
    description: `Blog objave označene sa ${tag.name}.`,
    canonical: `/blog/tag/${tag.slug}`,
    isIndexable: true,
  });

  return {
    ...posts,
    tag: { id: tag._id.toString(), naziv: tag.name, slug: tag.slug },
    categories,
    tags,
    seo,
  };
}

export async function getBlogPostData(slug) {
  if (!slug) validationError("slug");

  const post = await postService.getPublicPostBySlug(slug);

  let relatedPosts = [];
  const firstCategoryId = post.kategorije?.[0]?.id;
  if (firstCategoryId) {
    const related = await postService.findPublishedPosts({ limit: 4, filters: { category: firstCategoryId } });
    relatedPosts = (related.data || []).filter((p) => p.id !== post.id).slice(0, 3);
  }

  const seo = buildPageSeo({
    title: post.seo?.naslov || `${post.naslov} | Blog | Estatik Lab`,
    description: post.seo?.opis || post.kratakOpis,
    canonical: `/blog/${post.slug}`,
    isIndexable: true,
    type: "article",
  });

  return { post, relatedPosts, seo };
}

export async function searchBlogPosts(search, { limit = 9, page = 1 } = {}) {
  if (!search) validationError("search");

  const posts = await postService.findPublishedPosts({ limit, page, search });

  const seo = buildPageSeo({
    title: `Pretraga: ${search} | Blog | Estatik Lab`,
    description: `Rezultati pretrage za "${search}" na Estatik Lab blogu.`,
    canonical: `/blog/pretraga?q=${encodeURIComponent(search)}`,
    isIndexable: false,
  });

  return { ...posts, search, seo };
}

export default {
  getBlogLandingData,
  getBlogCategoryData,
  getBlogTagData,
  getBlogPostData,
  searchBlogPosts,
};