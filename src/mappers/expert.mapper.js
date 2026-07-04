import { formatDateTime } from "../utils/date.time.util.js";

function getFullName(expert) {
  return `${expert.firstName || ""} ${expert.lastName || ""}`.trim() || "Nepoznato";
}

function getServiceNames(expert) {
  if (!expert.services || !Array.isArray(expert.services)) return [];
  return expert.services
    .filter((svc) => svc && typeof svc === "object" && svc.name)
    .map((svc) => svc.name);
}

function formatImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
  };
}

export function mapExpertsForAdminList(experts = []) {
  return experts
    .map((expert) => {
      if (!expert) return null;
      return {
        id: expert._id.toString(),
        imePrezime: getFullName(expert),
        titula: expert.title || "",
        slug: expert.slug,
        brojUsluga: expert.services?.length || 0,
        aktivan: expert.isActive ? "Da" : "Ne",
        redosled: expert.order || 0,
        kreiran: formatDateTime(expert.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapExpertForAdminDetail(expert) {
  if (!expert) return null;

  return {
    id: expert._id.toString(),
    osnovno: {
      ime: expert.firstName,
      prezime: expert.lastName,
      slug: expert.slug,
      titula: expert.title || "",
      kratkaBiografija: expert.shortBio || "",
      biografija: expert.bio || "",
    },
    slika: formatImage(expert.image),
    galerija: (expert.gallery || []).map(formatImage),
    specijalizacije: expert.specializations || [],
    usluge: getServiceNames(expert),
    drustveneMreze: expert.socialLinks || {},
    aktivan: expert.isActive,
    redosled: expert.order || 0,
    vreme: {
      kreirano: formatDateTime(expert.createdAt),
      azurirano: formatDateTime(expert.updatedAt),
    },
  };
}

export function mapExpertForEdit(expert) {
  if (!expert) return null;

  return {
    id: expert._id.toString(),
    firstName: expert.firstName,
    lastName: expert.lastName,
    slug: expert.slug,
    title: expert.title || "",
    shortBio: expert.shortBio || "",
    bio: expert.bio || "",
    image: expert.image || null,
    gallery: expert.gallery || [],
    specializations: expert.specializations || [],
    services: (expert.services || []).map((s) => s._id?.toString() || s.toString()),
    socialLinks: expert.socialLinks || {},
    isActive: expert.isActive,
    order: expert.order || 0,
  };
}

// public "our experts" team page card
export function mapExpertForPublicCard(expert) {
  if (!expert) return null;

  return {
    id: expert._id.toString(),
    imePrezime: getFullName(expert),
    slug: expert.slug,
    titula: expert.title || "",
    kratkaBiografija: expert.shortBio || "",
    slika: formatImage(expert.image),
  };
}

export function mapExpertsForPublic(experts = []) {
  return experts.map(mapExpertForPublicCard).filter(Boolean);
}

// public individual expert profile page
export function mapExpertForPublicDetail(expert) {
  if (!expert) return null;

  return {
    id: expert._id.toString(),
    imePrezime: getFullName(expert),
    slug: expert.slug,
    titula: expert.title || "",
    kratkaBiografija: expert.shortBio || "",
    biografija: expert.bio || "",
    slika: formatImage(expert.image),
    galerija: (expert.gallery || []).map(formatImage),
    specijalizacije: expert.specializations || [],
    usluge: getServiceNames(expert),
    drustveneMreze: expert.socialLinks || {},
  };
}

export function mapExpertRaw(expert) {
  return expert;
}

export default {
  mapExpertsForAdminList,
  mapExpertForAdminDetail,
  mapExpertForEdit,
  mapExpertForPublicCard,
  mapExpertsForPublic,
  mapExpertForPublicDetail,
  mapExpertRaw,
};
