export function formatDateTime(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year}. ${hours}:${minutes}`;
}

export function formatDate(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}.${month}.${year}.`;
}

export function formatDateForInput(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDateTimeForInput(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, year, month, day, hours = "00", minutes = "00"] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  }

  const srMatch = input.match(/^(\d{2})\.(\d{2})\.(\d{4})\.?(?:\s+(\d{2}):(\d{2}))?/);
  if (srMatch) {
    const [, day, month, year, hours = "00", minutes = "00"] = srMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
  }

  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export function isValidDate(date) {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}

export default {
  formatDateTime,
  formatDate,
  formatDateForInput,
  formatDateTimeForInput,
  parseDate,
  isValidDate,
};