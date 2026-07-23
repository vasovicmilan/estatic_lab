import eventEmitter from "../event.emitter.js";
import * as commissionService from "../../services/commission.service.js";
import { logError } from "../../utils/logger.util.js";

function safe(eventName, handler) {
  return async (payload) => {
    try {
      await handler(payload);
    } catch (error) {
      logError(`[commission listener] Failed handling "${eventName}"`, error, { payload });
    }
  };
}

eventEmitter.on(
  "appointment:status_changed",
  safe("appointment:status_changed", async ({ appointmentId, status }) => {
    if (status !== "completed") return;
    await commissionService.recordAppointmentCommissions(appointmentId);
  })
);

eventEmitter.on(
  "order:confirmed",
  safe("order:confirmed", async ({ orderId }) => {
    await commissionService.recordOrderCommission(orderId);
  })
);

eventEmitter.on(
  "order:status_changed",
  safe("order:status_changed", async ({ orderId, status }) => {
    if (status !== "completed") return;
    await commissionService.promoteOrderCommissionOnCompletion(orderId);
  })
);

eventEmitter.on(
  "package_purchase:created",
  safe("package_purchase:created", async ({ packagePurchaseId }) => {
    await commissionService.recordPackagePurchaseCommission(packagePurchaseId);
  })
);

eventEmitter.on(
  "package_purchase:cancelled",
  safe("package_purchase:cancelled", async ({ packagePurchaseId }) => {
    await commissionService.reversePackagePurchaseCommission(packagePurchaseId);
  })
);