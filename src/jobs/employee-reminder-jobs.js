import appointmentService from "../services/appointment.service.js";
import emailService from "../services/email.service.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { alertError } from "../utils/telegram-alert.util.js";

// Same runJob(name, fn) shape as appointment-reminder-jobs.js/commission-jobs.js/
// post-jobs.js - every job file in src/jobs/ keeps its own copy of this rather
// than sharing one, which is the established convention here (see
// appointment-reminder-jobs.js's own comment on this). Do the work, log
// success, and on failure both log AND alert - same reasoning as the customer
// reminder job: a cron silently failing for weeks looks like nothing is wrong
// (the site itself works fine), and the whole point of this job is employees
// actually knowing their schedule, so a silent failure has a real cost.
async function runJob(name, fn) {
  try {
    await fn();
    logInfo(`[cron] ${name} completed successfully`);
  } catch (error) {
    logError(`[cron] ${name} failed`, error);
    alertError(`Zakazani zadatak "${name}" nije uspeo`, { job: name, errorMessage: error.message });
  }
}

// EMAIL ONLY, deliberately - unlike some other alerts in this codebase,
// employees have no per-employee Telegram chat id anywhere in the data model
// (see employee.model.js), so there's nothing to send a Telegram message to
// here even if it seemed useful. Email is also just the right channel for a
// digest meant to be read once, not an urgent ping.
//
// One digest EMAIL per employee, not one email per appointment - this is
// intentionally the opposite shape of the customer reminder job. A customer
// only ever has the one appointment a given reminder is about, so per-
// appointment makes sense there; an employee routinely has several
// appointments on the same day, and 8 separate "you have an appointment"
// emails would be worse than useless. Grouping happens one layer down, in
// appointment.service.js's findAppointmentsForEmployeeDigest.
//
// An employee with zero appointments for the day is simply never in the
// grouped list findAppointmentsForEmployeeDigest returns (see that function's
// grouping logic) - there is deliberately no "you have no appointments today"
// email; that would be pure noise for the common case of a day off.
async function sendDailyDigest({ dayOffset, sentAtField, when, jobName }) {
  return runJob(jobName, async () => {
    const groups = await appointmentService.findAppointmentsForEmployeeDigest(dayOffset, sentAtField);
    if (groups.length === 0) return;

    let sentToEmployees = 0;
    const sentAppointmentIds = [];

    for (const { employee, appointments } of groups) {
      // Inactive employees (isActive: false) don't work here anymore -
      // skipped the same way an inactive/deleted employee is skipped
      // everywhere else appointments are assigned/notified.
      if (!employee || employee.isActive === false) continue;

      const email = employee.userId?.email;
      const firstName = employee.userId?.firstName;
      if (!email) continue; // no populated userId.email - nothing to send to

      try {
        await emailService.sendEmployeeDailyDigestEmail({ email, firstName }, appointments, { when });
        sentAppointmentIds.push(...appointments.map((a) => a.id));
        sentToEmployees += 1;
      } catch (error) {
        // One employee's send failure is logged and skipped, never blocking
        // the rest of the batch - same resilience pattern as
        // appointment-reminder-jobs.js's sendRemindersForWindow.
        logError(`[cron] ${jobName} failed for employee ${employee._id}`, error, { employeeId: employee._id });
      }
    }

    // Bulk-mark every appointment that actually went out in one round trip
    // (see appointment.repository.js's markAppointmentsDigestSent) - a
    // digest run can easily cover dozens of appointments across many
    // employees in a single tick.
    if (sentAppointmentIds.length > 0) {
      await appointmentService.markEmployeeDigestSent(sentAppointmentIds, sentAtField);
    }

    if (sentToEmployees > 0) {
      logInfo(`[cron] ${jobName}: sent digest to ${sentToEmployees} of ${groups.length} employee(s)`);
    }
  });
}

/**
 * 19:00 run - tells each employee what they have scheduled TOMORROW. Uses
 * employeeEveningReminderSentAt as its guard field (see
 * appointment.model.js) and "sutra" framing in the email.
 */
export async function runEmployeeEveningDigest() {
  return sendDailyDigest({
    dayOffset: 1,
    sentAtField: "employeeEveningReminderSentAt",
    when: "sutra",
    jobName: "employee-evening-digest",
  });
}

/**
 * 08:00 run - tells each employee what they have scheduled TODAY. Uses
 * employeeMorningReminderSentAt as its guard field (see
 * appointment.model.js) and "danas" framing in the email.
 */
export async function runEmployeeMorningDigest() {
  return sendDailyDigest({
    dayOffset: 0,
    sentAtField: "employeeMorningReminderSentAt",
    when: "danas",
    jobName: "employee-morning-digest",
  });
}

export default { runEmployeeEveningDigest, runEmployeeMorningDigest };
