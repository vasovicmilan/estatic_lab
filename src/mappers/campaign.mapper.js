import { formatDateTime, utcDateToZonedInputValue } from "../utils/date.time.util.js";
import { renderContentBlocks } from "../utils/content-blocks.util.js";

function translateStatus(status) {
  const map = {
    draft: "Nacrt",
    scheduled: "Zakazano",
    sent: "Poslato",
  };
  return map[status] || status;
}

const INTEREST_LABELS = {
  general: "Opšte",
  products: "Proizvodi",
  partnership: "Partnerski program",
};

export function translateInterest(interest) {
  return INTEREST_LABELS[interest] || interest;
}

function getSegmentLabel(targetInterests = []) {
  if (!targetInterests.length) return "Svi pretplatnici";
  return targetInterests.map(translateInterest).join(", ");
}

export function mapCampaignsForAdminList(campaigns = []) {
  return campaigns
    .map((campaign) => {
      if (!campaign) return null;
      return {
        id: campaign._id.toString(),
        naslov: campaign.title,
        predmet: campaign.subject,
        status: translateStatus(campaign.status),
        statusRaw: campaign.status,
        segment: getSegmentLabel(campaign.targetInterests),
        zakazanoZa: campaign.status === "scheduled" && campaign.scheduledFor ? formatDateTime(campaign.scheduledFor) : null,
        poslatoZa: campaign.status === "sent" && campaign.sentAt ? formatDateTime(campaign.sentAt) : null,
        poslato: campaign.sentCount || 0,
        neuspesno: campaign.failedCount || 0,
        kreirano: formatDateTime(campaign.createdAt),
      };
    })
    .filter(Boolean);
}

export function mapCampaignForAdminDetail(campaign) {
  if (!campaign) return null;

  return {
    id: campaign._id.toString(),
    naslov: campaign.title,
    predmet: campaign.subject,
    status: translateStatus(campaign.status),
    statusRaw: campaign.status,
    segmenti: (campaign.targetInterests || []).map(translateInterest),
    segmentiRaw: campaign.targetInterests || [],
    segment: getSegmentLabel(campaign.targetInterests),
    sadrzaj: renderContentBlocks(campaign.content),
    zakazanoZa: campaign.scheduledFor ? formatDateTime(campaign.scheduledFor) : null,
    poslatoZa: campaign.sentAt ? formatDateTime(campaign.sentAt) : null,
    poslato: campaign.sentCount || 0,
    neuspesno: campaign.failedCount || 0,
    vreme: {
      kreiran: formatDateTime(campaign.createdAt),
      azuriran: formatDateTime(campaign.updatedAt),
    },
  };
}

export function mapCampaignForEdit(campaign) {
  if (!campaign) return null;

  return {
    id: campaign._id.toString(),
    title: campaign.title,
    subject: campaign.subject,
    content: campaign.content || [],
    targetInterests: campaign.targetInterests || [],
    status: campaign.status,
    // "YYYY-MM-DDTHH:mm" in Europe/Belgrade wall-clock time, same convention
    // as mapPostForEdit's scheduledFor - see date.time.util.js.
    scheduledFor: campaign.scheduledFor ? utcDateToZonedInputValue(campaign.scheduledFor) : "",
  };
}

export function mapCampaignRaw(campaign) {
  return campaign;
}

export default {
  mapCampaignsForAdminList,
  mapCampaignForAdminDetail,
  mapCampaignForEdit,
  mapCampaignRaw,
  translateInterest,
};
