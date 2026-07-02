export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "completed",
];

const TRANSITIONS = {
  pending: {
    admin: ["confirmed", "rejected", "cancelled"],
    employee: ["confirmed", "rejected"],
    user: ["cancelled"],
  },
  confirmed: {
    admin: ["completed", "cancelled", "rejected"],
    employee: ["completed", "rejected"],
    user: ["cancelled"],
  },
  rejected: {
    admin: ["pending"],
  },
  cancelled: {
    admin: ["pending"],
  },
  completed: {
  },
};

export function getAllowedStatuses(currentStatus, role) {
  return TRANSITIONS[currentStatus]?.[role] ?? [];
}

export function canTransition(currentStatus, nextStatus, role) {
  return getAllowedStatuses(currentStatus, role).includes(nextStatus);
}