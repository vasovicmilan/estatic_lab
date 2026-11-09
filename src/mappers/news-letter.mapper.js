import { formatDateTime, formatDate } from "../utils/date.time.util.js";

function translateStatus(status) {
  const map = {
    subscribed: "Prijavljen",
    unsubscribed: "Odjavljen",
  };
  return map[status] || status;
}

// general = studio services/treatments/packages, products = cosmetics & products,
// partnership = B2B / partner program - the three audiences a campaign can address.
const INTEREST_LABELS = {
  general: "Usluge, tretmani i paketi",
  products: "Kozmetika i proizvodi",
  partnership: "B2B / partnerstvo",
};

const SOURCE_LABELS = {
  footer: "Footer sajta",
  tocak: "Točak sreće",
  api: "API / frontend",
  admin: "Admin",
  unknown: "Nepoznato",
};

export function translateSource(source) {
  return SOURCE_LABELS[source || "unknown"] || source;
}

// Canonical label lookup for NEWSLETTER_INTERESTS (see news-letter.model.js) -
// campaign.mapper.js imports this too, rather than keeping its own copy, since
// a campaign's targetInterests and a subscriber's interests are the exact same
// enum and should always read the same in Serbian.
export function translateInterest(interest) {
  return INTEREST_LABELS[interest] || interest;
}

function formatSource(subscriber) {
  const label = translateSource(subscriber.source);
  return subscriber.sourceDetail ? `${label} (${subscriber.sourceDetail})` : label;
}

export function mapSubscribersForAdminList(subscribers = []) {
  return subscribers
    .map((subscriber) => {
      if (!subscriber) return null;
      return {
        id: subscriber._id.toString(),
        email: subscriber.email,
        status: translateStatus(subscriber.status),
        statusRaw: subscriber.status,
        interesovanja: (subscriber.interests || []).map(translateInterest).join(", "),
        izvor: formatSource(subscriber),
        prijavljen: formatDate(subscriber.subscribedAt),
      };
    })
    .filter(Boolean);
}

export function mapSubscriberForAdminDetail(subscriber) {
  if (!subscriber) return null;

  return {
    id: subscriber._id.toString(),
    osnovno: {
      email: subscriber.email,
      status: translateStatus(subscriber.status),
      statusRaw: subscriber.status,
      interesovanja: (subscriber.interests || []).map(translateInterest),
      izvor: translateSource(subscriber.source),
      izvorDetalj: subscriber.sourceDetail || null,
    },
    vreme: {
      prijavljen: formatDateTime(subscriber.subscribedAt),
      odjavljen: subscriber.unsubscribedAt ? formatDateTime(subscriber.unsubscribedAt) : null,
      kreirano: formatDateTime(subscriber.createdAt),
      azurirano: formatDateTime(subscriber.updatedAt),
    },
  };
}

export function mapSubscriberRaw(subscriber) {
  return subscriber;
}

export default {
  mapSubscribersForAdminList,
  mapSubscriberForAdminDetail,
  mapSubscriberRaw,
  translateInterest,
  translateSource,
};
