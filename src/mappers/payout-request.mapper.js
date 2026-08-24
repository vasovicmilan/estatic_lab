import { formatDateTime } from "../utils/date.time.util.js";
import { formatMoney } from "../utils/price.util.js";

const STATUS_LABELS = { requested: "Zatraženo", approved: "Odobreno", paid: "Isplaćeno", rejected: "Odbijeno" };

export function translateStatus(status) {
  return STATUS_LABELS[status] || status;
}

function getEarnerName(request) {
  if (request.earnerType === "employee") {
    if (request.employeeSnapshot?.name) return request.employeeSnapshot.name;
    const employee = request.employee;
    if (employee && typeof employee === "object" && employee.userId && typeof employee.userId === "object") {
      const first = employee.userId.firstName || "";
      const last = employee.userId.lastName || "";
      return `${first} ${last}`.trim() || "Nepoznato";
    }
    return "Nepoznato";
  }

  const partner = request.partner;
  if (partner && typeof partner === "object" && partner.userId && typeof partner.userId === "object") {
    const first = partner.userId.firstName || "";
    const last = partner.userId.lastName || "";
    return `${first} ${last}`.trim() || "Nepoznato";
  }
  return "Nepoznato";
}

export function mapPayoutRequestForAdminShort(request) {
  return {
    id: request._id.toString(),
    earnerType: request.earnerType === "employee" ? "Zaposleni" : "Partner",
    earnerName: getEarnerName(request),
    iznos: formatMoney(request.amount),
    status: translateStatus(request.status),
    statusRaw: request.status,
    zatrazeno: formatDateTime(request.requestedAt || request.createdAt),
  };
}

export function mapPayoutRequestsForAdminList(requests = []) {
  return requests.map(mapPayoutRequestForAdminShort).filter(Boolean);
}

export function mapPayoutRequestForAdminDetail(request) {
  if (!request) return null;
  return {
    id: request._id.toString(),
    earnerType: request.earnerType === "employee" ? "Zaposleni" : "Partner",
    earnerName: getEarnerName(request),
    iznos: formatMoney(request.amount),
    status: translateStatus(request.status),
    statusRaw: request.status,
    napomena: request.adminNote || null,
    vreme: {
      zatrazeno: formatDateTime(request.requestedAt || request.createdAt),
      odobreno: request.approvedAt ? formatDateTime(request.approvedAt) : null,
      isplaceno: request.paidAt ? formatDateTime(request.paidAt) : null,
      odbijeno: request.rejectedAt ? formatDateTime(request.rejectedAt) : null,
    },
  };
}

export default { mapPayoutRequestForAdminShort, mapPayoutRequestsForAdminList, mapPayoutRequestForAdminDetail, translateStatus };