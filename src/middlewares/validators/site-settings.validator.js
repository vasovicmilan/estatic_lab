import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { DAYS_OF_WEEK, TIME_STRING_RE } from "../../utils/working-hours.util.js";

// Request-shape validation only (right type/format for each field) - the
// business rules that actually depend on the WHOLE payload together (exactly
// 7 days, no day repeated, from < to only when isOpen) live in
// site-settings.service.js's updateWorkingHours/updateClosedDates, same
// division of labor as updatePolicy's own numericFields loop + the
// reschedule-tier cross-field check it does itself. Kept as a chain (not
// following collectValidationErrors) so both the web route (reads
// req.validationErrors to re-render the form) and the API route (chains
// handleApiValidationErrors after it) can reuse the exact same rules.
export const workingHoursValidators = [
  body("workingHours").isArray({ min: 7, max: 7 }).withMessage("Radno vreme mora sadržati tačno 7 dana u nedelji"),

  body("workingHours.*.day").isIn(DAYS_OF_WEEK).withMessage("Neispravan dan u nedelji"),

  body("workingHours.*.isOpen").optional().isBoolean().withMessage("isOpen mora biti tačno/netačno"),

  body("workingHours.*.from")
    .optional()
    .matches(TIME_STRING_RE)
    .withMessage("Neispravan format vremena (očekivano HH:MM)"),

  body("workingHours.*.to")
    .optional()
    .matches(TIME_STRING_RE)
    .withMessage("Neispravan format vremena (očekivano HH:MM)"),
];

export const closedDatesValidators = [
  body("closedDates").isArray().withMessage("Neradni dani moraju biti niz"),

  body("closedDates.*.date").isISO8601().withMessage("Neispravan datum"),

  body("closedDates.*.reason")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 200 })
    .withMessage("Razlog može imati najviše 200 karaktera"),

  body("closedDates.*.recurringYearly").optional().isBoolean().withMessage("recurringYearly mora biti tačno/netačno"),
];

export const validateWorkingHoursUpdate = [...workingHoursValidators, collectValidationErrors];
export const validateClosedDatesUpdate = [...closedDatesValidators, collectValidationErrors];

export default { workingHoursValidators, closedDatesValidators, validateWorkingHoursUpdate, validateClosedDatesUpdate };
