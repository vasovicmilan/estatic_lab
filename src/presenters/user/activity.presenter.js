import { formatDateTime } from "../../utils/date.time.util.js";
import { getUserActionLabel } from "../../utils/activity-labels.util.js";

/**
 * Customer view of their own history. Deliberately minimal: a label, a time, whether it
 * worked - no `changes`, no other people's emails, no raw action names, no user agent.
 * The IP is the customer's own and useful for spotting a login they did not make.
 */
export function prepareUserActivityTabData(result, query = {}) {
  return {
    items: result.data.map((item) => ({
      id: item.id,
      vreme: formatDateTime(item.timestamp),
      opis: getUserActionLabel(item.action) || "Aktivnost",
      uspesno: item.success,
      ip: item.ip || null,
    })),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/nalog/aktivnost",
      query,
    },
  };
}

export default { prepareUserActivityTabData };
