import { formatDateTime, formatDate } from "../utils/date.time.util.js";

function translateStatus(status) {
  const map = {
    subscribed: "Prijavljen",
    unsubscribed: "Odjavljen",
  };
  return map[status] || status;
}

const INTEREST_LABELS = {
  general: "Opšte",
  products: "Proizvodi",
  partnership: "Partnerski program",
};

// Canonical label lookup for NEWSLETTER_INTERESTS (see news-letter.model.js) -
// campaign.mapper.js imports this too, rather than keeping its own copy, since
// a campaign's targetInterests and a subscriber's interests are the exact same
// enum and should always read the same in Serbian.
export function translateInterest(interest) {
  return INTEREST_LABELS[interest] || interest;
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
        interesovanja: (subscriber.interests || []).map(translateInterest),
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
};
