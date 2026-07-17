export const BOOKING_BUFFER_MINUTES = 30;

// Fixed grid for offered start times (09:00, 09:30, 10:00...), independent of
// each service's own duration. Without this, slot start times drift by the
// service's duration (a 45-min service would offer 09:00, 09:45, 10:30... -
// non-round times customers don't expect). 30 min is standard for spa/wellness
// booking; drop to 15 only if you add noticeably short treatments.
export const SLOT_GRID_MINUTES = 30;

export default { BOOKING_BUFFER_MINUTES, SLOT_GRID_MINUTES };