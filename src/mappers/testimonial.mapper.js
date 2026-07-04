import { formatDateTime, formatDate } from "../utils/date.time.util.js";

function getDisplayName(testimonial) {
  if (testimonial.name) return testimonial.name;
  if (testimonial.user && typeof testimonial.user === "object") {
    return `${testimonial.user.firstName || ""} ${testimonial.user.lastName || ""}`.trim() || "Anonimno";
  }
  return "Anonimno";
}

function renderStars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function translateStatus(status) {
  const map = {
    pending: "Na čekanju",
    approved: "Odobren",
    rejected: "Odbijen",
  };
  return map[status] || status;
}

function formatImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
  };
}

function getServiceInfo(testimonial) {
  if (!testimonial.service) return null;
  if (typeof testimonial.service === "object") {
    return {
      id: testimonial.service._id.toString(),
      naziv: testimonial.service.name || "",
      slug: testimonial.service.slug || "",
    };
  }
  return { id: testimonial.service.toString() };
}

export function mapTestimonialsForAdminList(testimonials = []) {
  return testimonials
    .map((t) => {
      if (!t) return null;
      return {
        id: t._id.toString(),
        ime: getDisplayName(t),
        email: t.email || "",
        ocena: renderStars(t.rating),
        ocenaRaw: t.rating,
        komentar: t.message?.substring(0, 100) || "",
        usluga: getServiceInfo(t)?.naziv || "",
        status: translateStatus(t.status),
        statusRaw: t.status,
        istaknut: t.isFeatured ? "Da" : "Ne",
        kreiran: formatDate(t.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapTestimonialForAdminDetail(testimonial) {
  if (!testimonial) return null;

  return {
    id: testimonial._id.toString(),
    osnovno: {
      ime: getDisplayName(testimonial),
      email: testimonial.email || "",
      slika: formatImage(testimonial.image),
      ocena: testimonial.rating,
      ocenaZvezdice: renderStars(testimonial.rating),
      komentar: testimonial.message,
    },
    usluga: getServiceInfo(testimonial),
    korisnik: testimonial.user
      ? {
          userId: typeof testimonial.user === "object" ? testimonial.user._id?.toString() : testimonial.user.toString(),
          ime:
            typeof testimonial.user === "object"
              ? `${testimonial.user.firstName || ""} ${testimonial.user.lastName || ""}`.trim()
              : "",
        }
      : null,
    status: {
      vrednost: translateStatus(testimonial.status),
      vrednostRaw: testimonial.status,
      istaknut: testimonial.isFeatured,
      redosled: testimonial.order || 0,
    },
    vreme: {
      kreirano: formatDateTime(testimonial.createdAt),
      azurirano: formatDateTime(testimonial.updatedAt),
    },
  };
}

export function mapTestimonialForEdit(testimonial) {
  if (!testimonial) return null;

  return {
    id: testimonial._id.toString(),
    name: testimonial.name,
    email: testimonial.email || "",
    service: testimonial.service?._id?.toString() || testimonial.service?.toString() || null,
    rating: testimonial.rating,
    message: testimonial.message,
    image: testimonial.image || null,
    status: testimonial.status,
    isFeatured: testimonial.isFeatured,
    order: testimonial.order || 0,
  };
}

export function mapTestimonialForPublic(testimonial) {
  if (!testimonial) return null;

  return {
    id: testimonial._id.toString(),
    ime: getDisplayName(testimonial),
    slika: formatImage(testimonial.image),
    ocena: testimonial.rating,
    ocenaZvezdice: renderStars(testimonial.rating),
    komentar: testimonial.message,
    usluga: getServiceInfo(testimonial)?.naziv || null,
    uslugaSlug: getServiceInfo(testimonial)?.slug || null,
    datum: formatDate(testimonial.createdAt),
  };
}

export function mapTestimonialsForPublic(testimonials = []) {
  return testimonials.map(mapTestimonialForPublic).filter(Boolean);
}

export function mapTestimonialRaw(testimonial) {
  return testimonial;
}

export default {
  mapTestimonialsForAdminList,
  mapTestimonialForAdminDetail,
  mapTestimonialForEdit,
  mapTestimonialForPublic,
  mapTestimonialsForPublic,
  mapTestimonialRaw,
};
