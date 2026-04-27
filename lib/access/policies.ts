import type {
  AccessPolicy,
  ParentLink,
  Student,
  SubscriptionTier,
  ViewerRole,
} from "@/types/models";

export type ViewerContext = {
  uid: string;
  role: ViewerRole;
  student?: Student;
  parentLink?: ParentLink;
  policy?: AccessPolicy;
  tier?: SubscriptionTier;
};

export function canViewBus(
  context: ViewerContext,
  targetBusId: string,
): boolean {
  if (context.role === "admin") {
    return true;
  }

  if (context.role === "student") {
    return context.student?.busId === targetBusId;
  }

  if (context.role === "parent") {
    return context.student?.busId === targetBusId;
  }

  return false;
}

export function getVisibleBusIds(
  context: ViewerContext,
  allBusIds: string[],
): string[] {
  if (context.role === "admin") {
    return allBusIds;
  }

  const ownBusId = context.student?.busId;
  if (!ownBusId) {
    return [];
  }

  if (context.tier === "god" && context.policy?.allowedBusIds.length) {
    return Array.from(new Set([ownBusId, ...context.policy.allowedBusIds]));
  }

  return [ownBusId];
}

export function assertBusVisibility(
  context: ViewerContext,
  targetBusId: string,
): { ok: true } | { ok: false; reason: string } {
  if (canViewBus(context, targetBusId)) {
    return { ok: true };
  }

  if (context.role === "parent") {
    return {
      ok: false,
      reason: "Parent access is limited to the linked student's assigned bus.",
    };
  }

  if (context.role === "student") {
    return {
      ok: false,
      reason: "Student access is limited to the assigned bus.",
    };
  }

  return { ok: false, reason: "Access denied by policy." };
}
