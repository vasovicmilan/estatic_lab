export function parseCheckbox(rawValue, fallback = false) {
  const value = Array.isArray(rawValue) ? rawValue[rawValue.length - 1] : rawValue;
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === "on" || value === "1" || value === 1;
}

export default { parseCheckbox };