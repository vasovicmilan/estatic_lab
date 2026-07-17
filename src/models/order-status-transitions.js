export const ORDER_STATUSES = [
  "pending", // customer confirmed the order (via email token); awaiting admin processing
  "processing", // admin is preparing/packing the order
  "shipped", // handed off to delivery
  "delivered", // delivery confirmed
  "completed", // terminal success state - order fully closed out
  "cancelled", // cancelled before shipping (by admin or by the customer themselves)
  "returned", // customer sent it back after delivery
  "refunded", // money manually returned - terminal
];

// currentStatus -> { role -> [allowed next statuses] }
const TRANSITIONS = {
  pending: {
    admin: ["processing", "cancelled"],
    user: ["cancelled"],
  },
  processing: {
    admin: ["shipped", "cancelled"],
  },
  shipped: {
    admin: ["delivered", "returned"],
  },
  delivered: {
    admin: ["completed", "returned"],
  },
  completed: {
    // terminal - no role can transition out of "completed"
  },
  cancelled: {
    admin: ["pending"], // admin can reopen a mistakenly cancelled order
  },
  returned: {
    admin: ["refunded"],
  },
  refunded: {
    // terminal
  },
};

export function getAllowedStatuses(currentStatus, role) {
  return TRANSITIONS[currentStatus]?.[role] ?? [];
}

export function canTransition(currentStatus, nextStatus, role) {
  return getAllowedStatuses(currentStatus, role).includes(nextStatus);
}

// A customer can only cancel their own order themselves while it's still pending -
// unlike appointments there's no "time before start" cutoff, since an order has no
// start time; "has admin started processing it yet" is the natural equivalent cutoff
export function canUserCancelOrder(status) {
  return status === "pending";
}

// Shipping address/phone can only be edited before the order actually ships
export function canEditContactInfo(status) {
  return ["pending", "processing"].includes(status);
}