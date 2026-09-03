import { formatDateTime } from "../utils/date.time.util.js";
import { formatImage } from "../utils/image-format.util.js";
import { renderContentBlocks } from "../utils/content-blocks.util.js";

function hasMap(partner) {
  return partner.geo?.latitude != null && partner.geo?.longitude != null;
}

export function mapBusinessPartnersForAdminList(partners = []) {
  return partners
    .map((partner) => {
      if (!partner) return null;
      return {
        id: partner._id.toString(),
        naziv: partner.name,
        slika: formatImage(partner.coverImage),
        aktivan: partner.isActive,
        kreirano: formatDateTime(partner.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapBusinessPartnerForAdminDetail(partner) {
  if (!partner) return null;

  return {
    id: partner._id.toString(),
    naziv: partner.name,
    slug: partner.slug,
    kratakOpis: partner.shortDescription,
    slika: formatImage(partner.coverImage),
    adresa: partner.address || null,
    imaMapu: hasMap(partner),
    geo: hasMap(partner) ? { latitude: partner.geo.latitude, longitude: partner.geo.longitude } : null,
    outboundUrl: partner.outboundUrl,
    ctaLabel: partner.ctaLabel,
    aktivan: partner.isActive,
    sadrzaj: renderContentBlocks(partner.content),
    vreme: {
      kreiran: formatDateTime(partner.createdAt),
      azuriran: formatDateTime(partner.updatedAt),
    },
  };
}

export function mapBusinessPartnerForEdit(partner) {
  if (!partner) return null;

  return {
    id: partner._id.toString(),
    name: partner.name,
    slug: partner.slug,
    shortDescription: partner.shortDescription,
    content: partner.content || [],
    coverImage: partner.coverImage || null,
    address: partner.address || "",
    latitude: partner.geo?.latitude ?? "",
    longitude: partner.geo?.longitude ?? "",
    outboundUrl: partner.outboundUrl,
    ctaLabel: partner.ctaLabel,
    isActive: partner.isActive,
    seo: partner.seo || {},
  };
}

export function mapBusinessPartnersForPublicList(partners = []) {
  return partners.map((partner) => ({
    naziv: partner.name,
    slug: partner.slug,
    kratakOpis: partner.shortDescription,
    slika: formatImage(partner.coverImage),
  }));
}

export function mapBusinessPartnerForPublicDetail(partner) {
  return {
    naziv: partner.name,
    slug: partner.slug,
    kratakOpis: partner.shortDescription,
    slika: formatImage(partner.coverImage),
    adresa: partner.address || null,
    imaMapu: hasMap(partner),
    geo: hasMap(partner) ? { latitude: partner.geo.latitude, longitude: partner.geo.longitude } : null,
    outboundUrl: partner.outboundUrl,
    ctaLabel: partner.ctaLabel,
    sadrzaj: renderContentBlocks(partner.content),
    seo: partner.seo || {},
  };
}

export function mapBusinessPartnerRaw(partner) {
  return partner;
}

export default {
  mapBusinessPartnersForAdminList,
  mapBusinessPartnerForAdminDetail,
  mapBusinessPartnerForEdit,
  mapBusinessPartnersForPublicList,
  mapBusinessPartnerForPublicDetail,
  mapBusinessPartnerRaw,
};
