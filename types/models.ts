import { z } from "zod";

export const viewerRoleSchema = z.enum(["student", "parent", "admin"]);
export type ViewerRole = z.infer<typeof viewerRoleSchema>;

export const subscriptionTierSchema = z.enum(["free", "god", "enterprise"]);
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const accessPolicySchema = z.object({
  uid: z.string().min(1),
  role: viewerRoleSchema,
  allowedBusIds: z.array(z.string().min(1)).default([]),
  tier: subscriptionTierSchema.default("free"),
});
export type AccessPolicy = z.infer<typeof accessPolicySchema>;

export const collegeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(2),
  city: z.string().min(1),
  emailDomains: z.array(z.string().min(3)).default([]),
  active: z.boolean().default(true),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type College = z.infer<typeof collegeSchema>;

export const studentSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  collegeId: z.string().min(1),
  fullName: z.string().min(1),
  email: z.email(),
  busId: z.string().min(1),
  routeId: z.string().min(1),
  stopId: z.string().min(1),
  active: z.boolean().default(true),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Student = z.infer<typeof studentSchema>;

export const parentLinkSchema = z.object({
  id: z.string().min(1),
  parentUid: z.string().min(1),
  studentId: z.string().min(1),
  relationship: z.enum(["mother", "father", "guardian", "other"]),
  verified: z.boolean().default(false),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type ParentLink = z.infer<typeof parentLinkSchema>;

export const busSchema = z.object({
  id: z.string().min(1),
  collegeId: z.string().min(1),
  routeId: z.string().min(1),
  code: z.string().min(1),
  plateNumber: z.string().min(1),
  capacity: z.number().int().positive(),
  active: z.boolean().default(true),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Bus = z.infer<typeof busSchema>;

export const stopSchema = z.object({
  id: z.string().min(1),
  routeId: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  bufferMeters: z.number().nonnegative().default(100),
});
export type Stop = z.infer<typeof stopSchema>;

export const routeSchema = z.object({
  id: z.string().min(1),
  collegeId: z.string().min(1),
  name: z.string().min(1),
  direction: z.enum(["inbound", "outbound"]),
  stopIds: z.array(z.string().min(1)).min(1),
  /** Optional route polyline for deviation detection (Phase 2.4). */
  polyline: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  active: z.boolean().default(true),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Route = z.infer<typeof routeSchema>;

export const subscriptionSchema = z.object({
  id: z.string().min(1),
  collegeId: z.string().min(1),
  tier: subscriptionTierSchema,
  status: z.enum(["trial", "active", "past_due", "cancelled"]),
  seats: z.number().int().positive(),
  renewalAt: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const presenceSchema = z.object({
  uid: z.string().min(1),
  busId: z.string().min(1),
  activeRouteId: z.string().min(1),
  deviceId: z.string().min(1),
  appState: z.enum(["foreground", "background", "inactive"]),
  lastHeartbeatAt: z.number().int().nonnegative(),
  batteryLevel: z.number().min(0).max(1).optional(),
});
export type Presence = z.infer<typeof presenceSchema>;

export const trackerCandidateSchema = z.object({
  uid: z.string().min(1),
  busId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  accuracy: z.number().nonnegative(),
  routeMatchScore: z.number().min(0).max(1),
  submittedAt: z.number().int().nonnegative(),
  source: z.enum(["gps", "network", "fused"]).default("gps"),
});
export type TrackerCandidate = z.infer<typeof trackerCandidateSchema>;

export const trackerAssignmentSchema = z.object({
  busId: z.string().min(1),
  trackerUid: z.string().min(1),
  assignedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  reason: z.enum(["best_signal", "manual_override", "fallback"]),
});
export type TrackerAssignment = z.infer<typeof trackerAssignmentSchema>;

export const busLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  accuracy: z.number().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  sourceCount: z.number().int().nonnegative(),
  routeMatchScore: z.number().min(0).max(1),
});
export type BusLocation = z.infer<typeof busLocationSchema>;

export const busHealthSchema = z.object({
  busId: z.string().min(1),
  // healthy/degraded/stale/offline come from signal quality (Phase 0–1).
  // deviated/stranded/ghost come from spatial anomaly detection (Phase 2.4).
  status: z.enum(["healthy", "degraded", "stale", "offline", "deviated", "stranded", "ghost"]),
  activeContributors: z.number().int().nonnegative(),
  staleCandidateCount: z.number().int().nonnegative(),
  lastDerivedAt: z.number().int().nonnegative(),
  note: z.string().optional(),
});
export type BusHealth = z.infer<typeof busHealthSchema>;

/** Snapped path written by the aggregator (Phase 2.2). */
export const busPathSchema = z.object({
  pts: z.array(z.object({ lat: z.number(), lng: z.number() })),
  updatedAt: z.number().int().nonnegative(),
});
export type BusPath = z.infer<typeof busPathSchema>;
