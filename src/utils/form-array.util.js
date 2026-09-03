// Multiselect/checkbox-group form fields arrive as one of three shapes depending on
// how many boxes were checked: an array (2+), a single string (exactly 1), or
// undefined (0, since unchecked checkboxes aren't submitted at all). This
// normalizes all three into a plain array, dropping empty/falsy entries.
//
// Used anywhere an admin form field maps to an array of Mongo ObjectId strings -
// categories, tags, relatedProducts, relatedServices, resources, employees, etc.
export function toIdArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export default { toIdArray };
