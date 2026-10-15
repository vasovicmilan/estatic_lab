// Serbian labels for the customer-facing "Aktivnost" tab.
//
// This is an allow-list on purpose: the customer sees ONLY actions listed here. Admin-side
// entries (who approved what, internal notes, permission changes) and anything not yet
// labelled stay invisible to them, so a new internal audit action can never leak into the
// account view just because nobody thought about it.
export const USER_VISIBLE_ACTIONS = Object.freeze({
  // account & security
  USER_REGISTERED: "Napravljen nalog",
  ACCOUNT_VERIFIED: "Nalog potvrđen",
  LOGIN_SUCCEEDED: "Prijava na nalog",
  LOGIN_FAILED: "Neuspešan pokušaj prijave",
  LOGOUT: "Odjava sa naloga",
  PASSWORD_CHANGED: "Promenjena lozinka",
  PASSWORD_RESET_REQUESTED: "Zatraženo resetovanje lozinke",
  PASSWORD_RESET: "Lozinka resetovana",
  PASSWORD_SET: "Postavljena lozinka",
  ACCOUNT_DEACTIVATED: "Nalog deaktiviran",
  USER_SETTINGS_UPDATED: "Izmenjena podešavanja naloga",
  PROFILE_UPDATED: "Izmenjen profil",
  USER_ADDRESS_ADDED: "Dodata adresa",
  USER_ADDRESS_REMOVED: "Uklonjena adresa",
  USER_DEFAULT_ADDRESS_CHANGED: "Promenjena podrazumevana adresa",
  // shop
  CART_ITEM_ADDED: "Proizvod dodat u korpu",
  CART_ITEM_UPDATED: "Izmenjena količina u korpi",
  CART_ITEM_REMOVED: "Proizvod uklonjen iz korpe",
  COUPON_APPLIED: "Unet kupon",
  COUPON_REMOVED: "Uklonjen kupon",
  CHECKOUT_SUBMITTED: "Poslata porudžbina na potvrdu",
  ORDER_CONFIRMED_BY_CUSTOMER: "Porudžbina potvrđena",
  ORDER_CANCELLED: "Porudžbina otkazana",
  // booking
  BOOKING_CREATED: "Zakazan termin",
  APPOINTMENT_CANCELLED: "Termin otkazan",
  APPOINTMENT_RESCHEDULED: "Termin pomeren",
  // forms
  CONTACT_SUBMITTED: "Poslata poruka preko kontakt forme",
  TESTIMONIAL_SUBMITTED: "Poslat utisak",
  NEWSLETTER_SUBSCRIBED: "Prijava na newsletter",
  NEWSLETTER_UNSUBSCRIBED: "Odjava sa newslettera",
});

export function getUserActionLabel(action) {
  return USER_VISIBLE_ACTIONS[action] || null;
}

export function isUserVisibleAction(action) {
  return Object.prototype.hasOwnProperty.call(USER_VISIBLE_ACTIONS, action);
}

// admin side: known labels, falling back to the raw action name
export function getAdminActionLabel(action) {
  return USER_VISIBLE_ACTIONS[action] || action;
}

export default { USER_VISIBLE_ACTIONS, getUserActionLabel, isUserVisibleAction, getAdminActionLabel };
