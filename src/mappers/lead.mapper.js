import { formatDate, formatDateTime } from "../utils/date.time.util.js";
import { decryptField } from "../utils/encrypted-field.util.js";
import { decryptPhone } from "../utils/phone.util.js";

export const SEGMENT_LABELS = { usluge: "Tretmani", kozmetika: "Kozmetika", b2b: "Saradnja / B2B" };

function redeemed(lead) {
  return (lead.coupon?.usedCount || 0) > 0;
}

export function mapLeadsForAdminList(leads = []) {
  return leads.filter(Boolean).map((lead) => ({
    id: lead._id.toString(),
    imePrezime: `${lead.firstName} ${decryptField(lead.lastName) || ""}`.trim(),
    email: lead.email,
    segment: SEGMENT_LABELS[lead.segment] || lead.segment,
    izvor: lead.source,
    nagrada: lead.prizeLabel,
    kod: lead.couponCode,
    iskoriscen: redeemed(lead) ? "Da" : "Ne",
    datum: formatDate(lead.createdAt),
  }));
}

export function mapLeadForAdminDetail(lead) {
  if (!lead) return null;
  return {
    id: lead._id.toString(),
    osnovno: {
      ime: lead.firstName,
      prezime: decryptField(lead.lastName),
      email: lead.email,
      telefon: decryptPhone(lead.phone),
      segment: SEGMENT_LABELS[lead.segment] || lead.segment,
      izvor: lead.source,
      saglasnostKontakt: lead.consentContact ? "Da" : "Ne",
      saglasnostMarketing: lead.consentMarketing ? "Da" : "Ne",
    },
    nagrada: {
      naziv: lead.prizeLabel,
      kod: lead.couponCode,
      vaziDo: formatDateTime(lead.couponValidUntil),
      iskoriscen: redeemed(lead) ? "Da" : "Ne",
    },
    vreme: { kreirano: formatDateTime(lead.createdAt) },
  };
}

// a cell that starts with = + - @ would be run as a formula by Excel/Sheets - prefix it
function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function mapLeadsToCsv(leads = []) {
  const header = ["Datum", "Ime", "Prezime", "Email", "Telefon", "Segment", "Izvor", "Newsletter", "Nagrada", "Kod", "Važi do", "Iskorišćen"];
  const rows = leads.map((l) =>
    [
      formatDateTime(l.createdAt),
      l.firstName,
      decryptField(l.lastName),
      l.email,
      decryptPhone(l.phone),
      SEGMENT_LABELS[l.segment] || l.segment,
      l.source,
      l.consentMarketing ? "Da" : "Ne",
      l.prizeLabel,
      l.couponCode,
      formatDate(l.couponValidUntil),
      redeemed(l) ? "Da" : "Ne",
    ].map(csvCell).join(",")
  );
  // BOM so Excel opens the Serbian diacritics correctly
  return "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n");
}

export default { mapLeadsForAdminList, mapLeadForAdminDetail, mapLeadsToCsv, SEGMENT_LABELS };
