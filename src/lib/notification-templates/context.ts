export type NotificationTemplateVariableValue =
  | string
  | number
  | null
  | undefined;

export type NotificationTemplateContext =
  | {
      kind: "new_partner";
      partnerName: string;
      partnerCategory: string;
      partnerLocation: string;
      partnerUrl: string;
      campusNames: string;
      benefitSummary: string;
      conditions: string;
      periodStart: string;
      periodEnd: string;
      mapUrl: string;
    }
  | {
      kind: "expiring_partner";
      partnerName: string;
      partnerCategory: string;
      partnerLocation: string;
      periodEnd: string;
      daysUntilEnd: string;
      partnerUrl: string;
    }
  | {
      kind: "admin_partner_change_request";
      companyName: string;
      partnerName: string;
      requesterName: string;
      changeSummary: string;
      requestUrl: string;
    }
  | {
      kind: "admin_partner_plan_upgrade_request";
      companyName: string;
      partnerName: string;
      requesterName: string;
      currentPlanName: string;
      requestedPlanName: string;
      amountKrw: string;
      requestUrl: string;
    }
  | {
      kind: "admin_partner_immediate_update";
      companyName: string;
      partnerName: string;
      changeSummary: string;
      updatedByName: string;
      partnerUrl: string;
    }
  | {
      kind: "admin_expiring_partner";
      partnerName: string;
      partnerCategory: string;
      partnerLocation: string;
      periodEnd: string;
      daysUntilEnd: string;
      adminUrl: string;
    }
  | {
      kind: "admin_security_permission_granted";
      targetLoginId: string;
      actionName: string;
      permissionTemplateName: string;
      managedCampusNames: string;
      adminUrl: string;
    }
  | {
      kind: "admin_security_status_changed";
      targetLoginId: string;
      statusName: string;
      actorLoginId: string;
      adminUrl: string;
    }
  | {
      kind: "admin_security_template_changed";
      targetLoginId: string;
      permissionTemplateName: string;
      actorLoginId: string;
      managedCampusNames: string;
      adminUrl: string;
    }
  | {
      kind: "partner_expiring_partner";
      partnerName: string;
      partnerCategory: string;
      partnerLocation: string;
      periodEnd: string;
      daysUntilEnd: string;
      partnerUrl: string;
    }
  | {
      kind: "partner_plan_changed";
      partnerName: string;
      previousPlanName: string;
      nextPlanName: string;
      effectiveAt: string;
      expiresAt: string;
      planUrl: string;
      note: string;
    }
  | {
      kind: "partner_plan_upgrade_requested";
      partnerName: string;
      requestedPlanName: string;
      amountKrw: string;
      paymentDueAt: string;
      planUrl: string;
    }
  | {
      kind: "partner_plan_upgrade_approved";
      partnerName: string;
      requestedPlanName: string;
      effectiveAt: string;
      expiresAt: string;
      planUrl: string;
    }
  | {
      kind: "partner_plan_upgrade_rejected";
      partnerName: string;
      requestedPlanName: string;
      rejectionReason: string;
      planUrl: string;
    };

export type NotificationTemplateContextKind = NotificationTemplateContext["kind"];

export function getNotificationTemplateContextVariables(
  context: NotificationTemplateContext,
): Record<string, NotificationTemplateVariableValue> {
  switch (context.kind) {
    case "new_partner":
      return {
        partnerName: context.partnerName,
        partnerCategory: context.partnerCategory,
        partnerLocation: context.partnerLocation,
        partnerUrl: context.partnerUrl,
        campusNames: context.campusNames,
        benefitSummary: context.benefitSummary,
        conditions: context.conditions,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd,
        mapUrl: context.mapUrl,
      };
    case "expiring_partner":
    case "partner_expiring_partner":
      return {
        partnerName: context.partnerName,
        partnerCategory: context.partnerCategory,
        partnerLocation: context.partnerLocation,
        periodEnd: context.periodEnd,
        daysUntilEnd: context.daysUntilEnd,
        partnerUrl: context.partnerUrl,
      };
    case "admin_expiring_partner":
      return {
        partnerName: context.partnerName,
        partnerCategory: context.partnerCategory,
        partnerLocation: context.partnerLocation,
        periodEnd: context.periodEnd,
        daysUntilEnd: context.daysUntilEnd,
        adminUrl: context.adminUrl,
      };
    case "admin_partner_change_request":
      return {
        companyName: context.companyName,
        partnerName: context.partnerName,
        requesterName: context.requesterName,
        changeSummary: context.changeSummary,
        requestUrl: context.requestUrl,
      };
    case "admin_partner_plan_upgrade_request":
      return {
        companyName: context.companyName,
        partnerName: context.partnerName,
        requesterName: context.requesterName,
        currentPlanName: context.currentPlanName,
        requestedPlanName: context.requestedPlanName,
        amountKrw: context.amountKrw,
        requestUrl: context.requestUrl,
      };
    case "admin_partner_immediate_update":
      return {
        companyName: context.companyName,
        partnerName: context.partnerName,
        changeSummary: context.changeSummary,
        updatedByName: context.updatedByName,
        partnerUrl: context.partnerUrl,
      };
    case "admin_security_permission_granted":
      return {
        targetLoginId: context.targetLoginId,
        actionName: context.actionName,
        permissionTemplateName: context.permissionTemplateName,
        managedCampusNames: context.managedCampusNames,
        adminUrl: context.adminUrl,
      };
    case "admin_security_status_changed":
      return {
        targetLoginId: context.targetLoginId,
        statusName: context.statusName,
        actorLoginId: context.actorLoginId,
        adminUrl: context.adminUrl,
      };
    case "admin_security_template_changed":
      return {
        targetLoginId: context.targetLoginId,
        permissionTemplateName: context.permissionTemplateName,
        actorLoginId: context.actorLoginId,
        managedCampusNames: context.managedCampusNames,
        adminUrl: context.adminUrl,
      };
    case "partner_plan_changed":
      return {
        partnerName: context.partnerName,
        previousPlanName: context.previousPlanName,
        nextPlanName: context.nextPlanName,
        effectiveAt: context.effectiveAt,
        expiresAt: context.expiresAt,
        planUrl: context.planUrl,
        note: context.note,
      };
    case "partner_plan_upgrade_requested":
      return {
        partnerName: context.partnerName,
        requestedPlanName: context.requestedPlanName,
        amountKrw: context.amountKrw,
        paymentDueAt: context.paymentDueAt,
        planUrl: context.planUrl,
      };
    case "partner_plan_upgrade_approved":
      return {
        partnerName: context.partnerName,
        requestedPlanName: context.requestedPlanName,
        effectiveAt: context.effectiveAt,
        expiresAt: context.expiresAt,
        planUrl: context.planUrl,
      };
    case "partner_plan_upgrade_rejected":
      return {
        partnerName: context.partnerName,
        requestedPlanName: context.requestedPlanName,
        rejectionReason: context.rejectionReason,
        planUrl: context.planUrl,
      };
  }
}
export function mergeNotificationTemplateVariables(input: {
  common?: Record<string, NotificationTemplateVariableValue>;
  context?: NotificationTemplateContext;
}) {
  return {
    ...(input.common ?? {}),
    ...(input.context
      ? getNotificationTemplateContextVariables(input.context)
      : {}),
  } satisfies Record<string, NotificationTemplateVariableValue>;
}
