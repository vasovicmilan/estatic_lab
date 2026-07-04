import { formatDateTime } from "../utils/date.time.util.js";

function translateDomain(domain) {
  const map = {
    post: "Blog",
    service: "Usluga",
  };
  return map[domain] || domain;
}

export function mapTagsForAdminList(tags = []) {
  return tags
    .map((tag) => {
      if (!tag) return null;
      return {
        id: tag._id.toString(),
        naziv: tag.name,
        slug: tag.slug,
        domen: translateDomain(tag.domain),
        domenRaw: tag.domain,
        aktivan: tag.isActive ? "Da" : "Ne",
        kreiran: formatDateTime(tag.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapTagForAdminDetail(tag) {
  if (!tag) return null;

  return {
    id: tag._id.toString(),
    naziv: tag.name,
    slug: tag.slug,
    domen: tag.domain,
    aktivan: tag.isActive,
    vreme: {
      kreiran: formatDateTime(tag.createdAt),
      azuriran: formatDateTime(tag.updatedAt),
    },
  };
}

export function mapTagForEdit(tag) {
  if (!tag) return null;

  return {
    id: tag._id.toString(),
    name: tag.name,
    slug: tag.slug,
    domain: tag.domain,
    isActive: tag.isActive,
  };
}

export function mapTagForPublic(tag) {
  if (!tag) return null;

  return {
    id: tag._id.toString(),
    naziv: tag.name,
    slug: tag.slug,
    domen: tag.domain,
  };
}

export function mapTagsForPublic(tags = []) {
  return tags.map(mapTagForPublic).filter(Boolean);
}

export function mapTagForSelect(tag) {
  if (!tag) return null;

  return {
    id: tag._id.toString(),
    slug: tag.slug,
    naziv: tag.name,
  };
}

export function mapTagsForSelect(tags = []) {
  return tags.map(mapTagForSelect).filter(Boolean);
}

export function mapTagRaw(tag) {
  return tag;
}

export default {
  mapTagsForAdminList,
  mapTagForAdminDetail,
  mapTagForEdit,
  mapTagForPublic,
  mapTagsForPublic,
  mapTagForSelect,
  mapTagsForSelect,
  mapTagRaw,
};
