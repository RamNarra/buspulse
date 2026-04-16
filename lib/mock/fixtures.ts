import type {
  AccessPolicy,
  Bus,
  BusHealth,
  BusLocation,
  College,
  ParentLink,
  Route,
  Stop,
  Student,
  Subscription,
  TrackerCandidate,
} from "@/types/models";
import { deriveLocationFromCandidates } from "@/lib/live/scoring";
import { estimateEtaMinutes } from "@/lib/live/eta";

const now = 1_747_000_000_000;

export const mockCollege: College = {
  id: "college-hyd-01",
  name: "Aurora Engineering College",
  code: "AEC",
  city: "Hyderabad",
  emailDomains: ["aurora.edu.in"],
  active: true,
  createdAt: now,
  updatedAt: now,
};

export const mockRoute: Route = {
  id: "route-a1",
  collegeId: mockCollege.id,
  name: "Kukatpally to Campus",
  direction: "inbound",
  stopIds: ["stop-kphb", "stop-jntuh", "stop-nizampet", "stop-campus"],
  active: true,
  createdAt: now,
  updatedAt: now,
};

export const mockStops: Stop[] = [
  {
    id: "stop-kphb",
    routeId: mockRoute.id,
    name: "KPHB Metro",
    order: 1,
    lat: 17.4931,
    lng: 78.3914,
    bufferMeters: 150,
  },
  {
    id: "stop-jntuh",
    routeId: mockRoute.id,
    name: "JNTU Main Gate",
    order: 2,
    lat: 17.4935,
    lng: 78.391,
    bufferMeters: 150,
  },
  {
    id: "stop-nizampet",
    routeId: mockRoute.id,
    name: "Nizampet X Roads",
    order: 3,
    lat: 17.515,
    lng: 78.3742,
    bufferMeters: 150,
  },
  {
    id: "stop-campus",
    routeId: mockRoute.id,
    name: "Aurora Campus",
    order: 4,
    lat: 17.5369,
    lng: 78.3577,
    bufferMeters: 200,
  },
];

export const mockBus: Bus = {
  id: "bus-a1",
  collegeId: mockCollege.id,
  routeId: mockRoute.id,
  code: "AEC-A1",
  plateNumber: "TS09AB1234",
  capacity: 48,
  active: true,
  createdAt: now,
  updatedAt: now,
};

export const mockStudent: Student = {
  id: "student-001",
  uid: "uid-student-001",
  collegeId: mockCollege.id,
  fullName: "Rahul Varma",
  email: "rahul.varma@aurora.edu.in",
  busId: mockBus.id,
  routeId: mockRoute.id,
  stopId: "stop-jntuh",
  active: true,
  createdAt: now,
  updatedAt: now,
};

export const mockParentLink: ParentLink = {
  id: "plink-001",
  parentUid: "uid-parent-001",
  studentId: mockStudent.id,
  relationship: "guardian",
  verified: true,
  createdAt: now,
  updatedAt: now,
};

export const mockSubscription: Subscription = {
  id: "sub-aurora",
  collegeId: mockCollege.id,
  tier: "premium",
  status: "active",
  seats: 2200,
  renewalAt: now + 1000 * 60 * 60 * 24 * 20,
  createdAt: now,
  updatedAt: now,
};

export const mockPolicy: AccessPolicy = {
  uid: mockStudent.uid,
  role: "student",
  allowedBusIds: [mockBus.id],
  tier: mockSubscription.tier,
};

const candidateBase: Omit<TrackerCandidate, "uid" | "submittedAt" | "source"> = {
  busId: mockBus.id,
  lat: 17.506,
  lng: 78.382,
  heading: 120,
  speed: 9,
  accuracy: 18,
  routeMatchScore: 0.84,
};

export const mockCandidates: TrackerCandidate[] = [
  {
    ...candidateBase,
    uid: "uid-student-001",
    submittedAt: now - 8_000,
    source: "gps",
  },
  {
    ...candidateBase,
    uid: "uid-student-004",
    lat: 17.507,
    lng: 78.3815,
    speed: 8,
    accuracy: 21,
    routeMatchScore: 0.79,
    submittedAt: now - 12_000,
    source: "fused",
  },
];

export const mockBusLocation: BusLocation =
  deriveLocationFromCandidates(mockCandidates, now) ?? {
    lat: candidateBase.lat,
    lng: candidateBase.lng,
    heading: candidateBase.heading,
    speed: candidateBase.speed,
    accuracy: candidateBase.accuracy,
    updatedAt: now,
    confidence: 0.68,
    sourceCount: 1,
    routeMatchScore: candidateBase.routeMatchScore,
  };

export const mockBusHealth: BusHealth = {
  busId: mockBus.id,
  status: "healthy",
  activeContributors: mockCandidates.length,
  staleCandidateCount: 0,
  lastDerivedAt: now,
  note: "Fixture-only health payload for UI development.",
};

export function getMockEtaByStop() {
  return mockStops.map((stop) => ({
    stop,
    etaMinutes: estimateEtaMinutes(mockBusLocation, stop),
  }));
}

export function getMockBusSnapshot(busId: string) {
  if (busId !== mockBus.id) {
    return null;
  }

  return {
    college: mockCollege,
    route: mockRoute,
    stops: mockStops,
    bus: mockBus,
    student: mockStudent,
    busLocation: mockBusLocation,
    busHealth: mockBusHealth,
  };
}
