import appointmentService from "../services/appointment.service.js";
import emailService from "../services/email.service.js";
import { APPOINTMENT_REMINDER_WINDOWS } from "../config/reminder.config.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

// Same shape as commission-jobs.js/post-jobs.js's runJob: do the work, log
// success, and on failure both log AND alert - a reminder cron silently
// failing is easy to miss for weeks since nothing about the site itself looks
// broken, and the whole point of this job is reducing no-shows, so a silent
// failure has a real, ongoing cost.
async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

/**
 * Sends the reminder for one window (see reminder.config.js) to every confirmed
 * appointment that's due and hasn't had this particular reminder sent yet. One
 * bad appointment (e.g. a stale/orphaned user reference) is logged and skipped
 * rather than blocking the rest of the batch - same reasoning as post-jobs.js's
 * runPublishScheduledPosts.
 */
async function sendRemindersForWindow({ hoursBefore, sentAtField, jobName }) {
  return runJob(jobName, async () => {
    const dueAppointments = await appointmentService.findAppointmentsDueForReminder(sentAtField, hoursBefore);
    if (dueAppointments.length === 0) return;

    let sent = 0;
    for (const appointment of dueAppointments) {
      const email = appointment.korisnik?.email;
      const firstName = appointment.korisnik?.ime;
      if (!email) continue;

      try {
        await emailService.sendAppointmentReminderEmail({ email, firstName }, appointment, hoursBefore);
        await appointmentService.markReminderSent(appointment.id, sentAtField);
        sent += 1;
      } catch (error) {
        logError(`[cron] ${jobName} failed for appointment ${appointment.id}`, error, { appointmentId: appointment.id });
      }
    }

    if (sent > 0) {
      logInfo(`[cron] ${jobName}: sent ${sent} of ${dueAppointments.length} due reminder(s)`);
    }
  });
}

export async function runAppointmentReminders() {
  for (const window of APPOINTMENT_REMINDER_WINDOWS) {
    await sendRemindersForWindow(window);
  }
}

export default { runAppointmentReminders };