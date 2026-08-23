// Single source of truth for how many reminder windows exist and how far ahead
// each one fires. Consumed by appointment-reminder-jobs.js (which reminder to
// send and which flag guards it) and scheduler.js (which just schedules one
// cron tick per window). Add a new window here (e.g. a 1h reminder) and both
// the job and the scheduler pick it up without further changes.
export const APPOINTMENT_REMINDER_WINDOWS = [
  { hoursBefore: 24, sentAtField: "reminder24hSentAt", jobName: "appointment-reminder-24h" },
  { hoursBefore: 4, sentAtField: "reminder4hSentAt", jobName: "appointment-reminder-4h" },
];