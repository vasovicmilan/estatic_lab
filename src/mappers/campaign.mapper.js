import { formatDateTime, utcDateToZonedInputValue } from "../utils/date.time.util.js";
import { renderContentBlocks } from "../utils/content-blocks.util.js";
import { translateInterest } from "./news-letter.mapper.js";

function translateStatus(status) {
  const map = {
    draft: "Nacrt",
    scheduled: "Zakazano",
    sent: "Poslato",
  };
  return map[status] || status;
}

// single source of truth for segment labels lives next to the subscriber mapper
export { translateInterest };

function getSegmentLabel(targetInterests = []) {
  if (!targetInterests.length) return "Svi pretplatnici";
  return targetInterests.map(translateInterest).join(", ");
}

function describeSources(campaign) {
  const parts = [];
  if ((campaign.targetSources || []).length) parts.push(campaign.targetSources.join(", "));
  if (campaign.onlyUnusedCoupon) parts.push("samo neiskorišćeni kuponi");
  return parts.length ? parts.join(" · ") : "Svi";
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
    izvori: describeSources(campaign),
    // the details page's shared block renderer knows the "cta" shape; a "file" block is the same
    // title + text + button, so it is shown as one
    sadrzaj: renderContentBlocks((campaign.content || []).map((block) => (block.type === "file" ? { ...block, type: "cta" } : block))),
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
    targetSources: campaign.targetSources || [],
    onlyUnusedCoupon: !!campaign.onlyUnusedCoupon,
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
