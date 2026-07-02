import { formatDateTime, formatDate } from "../utils/date.time.util.js";

function translateStatus(status) {
  const map = {
    subscribed: "Prijavljen",
    unsubscribed: "Odjavljen",
  };
  return map[status] || status;
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
};