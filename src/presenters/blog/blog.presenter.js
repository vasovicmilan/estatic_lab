export function prepareBlogListData(result, { query = {}, categories = [], tags = [] } = {}) {
  return {
    posts: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/blog",
      query,
    },
    sidebar: {
      categories,
      tags,
    },
    search: query.search || "",
    breadcrumbs: [{ label: "Blog", url: null }],
  };
}

export function prepareBlogCategoryData(category, result, query = {}) {
  return {
    category,
    posts: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/blog/kategorija/${category.slug}`,
      query,
    },
    breadcrumbs: [
      { label: "Blog", url: "/blog" },
      { label: category.naziv, url: null },
    ],
  };
}

export function prepareBlogTagData(tag, result, query = {}) {
  return {
    tag,
    posts: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: `/blog/tag/${tag.slug}`,
      query,
    },
    breadcrumbs: [
      { label: "Blog", url: "/blog" },
      { label: tag.naziv, url: null },
    ],
  };
}

export function prepareBlogPostData(post, { relatedPosts = [] } = {}) {
  return {
    post,
    relatedPosts,
    breadcrumbs: [
      { label: "Blog", url: "/blog" },
      { label: post.naslov, url: null },
    ],
  };
}