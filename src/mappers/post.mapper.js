import { formatDateTime, formatDate } from "../utils/date.time.util.js";

function translateStatus(status) {
  const map = {
    draft: "Nacrt",
    published: "Objavljeno",
    archived: "Arhivirano",
  };
  return map[status] || status;
}

function getAuthorName(post) {
  if (post.author && typeof post.author === "object") {
    return `${post.author.firstName || ""} ${post.author.lastName || ""}`.trim() || "Nepoznat autor";
  }
  return "Nepoznat autor";
}

function getAuthorAvatar(post) {
  if (post.author && typeof post.author === "object") return post.author.avatar || null;
  return null;
}

function getAuthorId(author) {
  if (!author) return null;
  return typeof author === "object" ? author._id?.toString() : author.toString();
}

function getCategoryNames(post) {
  if (!post.categories || !Array.isArray(post.categories)) return [];
  return post.categories.filter((c) => c && typeof c === "object" && c.name).map((c) => c.name);
}

function getCategorySlugs(post) {
  if (!post.categories || !Array.isArray(post.categories)) return [];
  return post.categories.filter((c) => c && typeof c === "object" && c.slug).map((c) => c.slug);
}

function getTagNames(post) {
  if (!post.tags || !Array.isArray(post.tags)) return [];
  return post.tags.filter((t) => t && typeof t === "object" && t.name).map((t) => t.name);
}

function formatCoverImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
  };
}

function renderContentBlocks(blocks = []) {
  return (blocks || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((block) => ({
      tip: block.type,
      tekst: block.text || null,
      nivo: block.level || null,
      slika: block.image ? { url: block.image.img, alt: block.image.imgDesc } : null,
      video: block.video || null,
      stavke: block.items || null,
      uredjeno: Boolean(block.ordered),
      izvor: block.meta || null,
    }));
}

export function mapPostsForAdminList(posts = []) {
  return posts
    .map((post) => {
      if (!post) return null;
      return {
        id: post._id.toString(),
        naslov: post.title,
        slug: post.slug,
        status: translateStatus(post.status),
        statusRaw: post.status,
        autor: getAuthorName(post),
        kategorije: getCategoryNames(post),
        pregledi: post.views || 0,
        datumObjave: post.publishedAt ? formatDate(post.publishedAt) : null,
        kreiran: formatDate(post.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapPostForAdminDetail(post) {
  if (!post) return null;

  return {
    id: post._id.toString(),
    naslov: post.title,
    slug: post.slug,
    status: translateStatus(post.status),
    statusRaw: post.status,
    autor: {
      ime: getAuthorName(post),
      avatar: getAuthorAvatar(post),
    },
    kategorije: getCategoryNames(post),
    tagovi: getTagNames(post),
    kratakOpis: post.excerpt,
    sadrzaj: renderContentBlocks(post.content),
    slika: formatCoverImage(post.coverImage),
    galerija: (post.gallery || []).map(formatCoverImage),
    seo: {
      naslov: post.seo?.title || null,
      opis: post.seo?.description || null,
      kljucneReci: post.seo?.keywords || [],
    },
    indeksiranje: post.isIndexable ? "Dozvoljeno" : "Zabranjeno",
    vremeCitanja: `${post.readingTimeMinutes} min`,
    pregledi: post.views || 0,
    datumObjave: post.publishedAt ? formatDateTime(post.publishedAt) : null,
    vreme: {
      kreiran: formatDateTime(post.createdAt),
      azuriran: formatDateTime(post.updatedAt),
    },
  };
}

export function mapPostForEdit(post) {
  if (!post) return null;

  return {
    id: post._id.toString(),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content || [],
    coverImage: post.coverImage,
    gallery: post.gallery || [],
    categories: (post.categories || []).map((c) => c._id?.toString() || c.toString()),
    tags: (post.tags || []).map((t) => t._id?.toString() || t.toString()),
    author: getAuthorId(post.author),
    status: post.status,
    seo: post.seo || {},
    isIndexable: post.isIndexable,
  };
}

export function mapPostsForCards(posts = []) {
  return posts
    .map((post) => {
      if (!post) return null;
      return {
        id: post._id.toString(),
        naslov: post.title,
        slug: post.slug,
        kratakOpis: post.excerpt,
        slika: formatCoverImage(post.coverImage),
        kategorije: getCategoryNames(post),
        autor: getAuthorName(post),
        datumObjave: formatDate(post.publishedAt),
        vremeCitanja: `${post.readingTimeMinutes} min`,
      };
    })
    .filter(Boolean);
}

export function mapPostForPublicDetail(post) {
  if (!post) return null;

  return {
    id: post._id.toString(),
    naslov: post.title,
    slug: post.slug,
    kratakOpis: post.excerpt,
    sadrzaj: renderContentBlocks(post.content),
    slika: formatCoverImage(post.coverImage),
    galerija: (post.gallery || []).map(formatCoverImage),
    autor: {
      ime: getAuthorName(post),
      avatar: getAuthorAvatar(post),
    },
    kategorije: getCategorySlugs(post),
    tagovi: getTagNames(post),
    seoKljucneReci: post.seo?.keywords || [],
    datumObjave: formatDate(post.publishedAt),
    poslednjeAzuriranje: formatDate(post.updatedAt),
    vremeCitanja: `${post.readingTimeMinutes} min`,
  };
}

export function mapPostRaw(post) {
  return post;
}

export default {
  mapPostsForAdminList,
  mapPostForAdminDetail,
  mapPostForEdit,
  mapPostsForCards,
  mapPostForPublicDetail,
  mapPostRaw,
};