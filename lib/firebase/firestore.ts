import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";

import {
  busSchema,
  collegeSchema,
  parentLinkSchema,
  routeSchema,
  stopSchema,
  studentSchema,
  subscriptionSchema,
  type Bus,
  type College,
  type ParentLink,
  type Route,
  type Stop,
  type Student,
  type Subscription,
} from "@/types/models";
import { getFirebaseClientApp } from "@/lib/firebase/client";

export const canonicalCollections = [
  "colleges",
  "students",
  "buses",
  "routes",
  "stops",
  "parentLinks",
  "subscriptions",
  "roles",
  "accessPolicies",
] as const;

export type CanonicalCollectionName = (typeof canonicalCollections)[number];

export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseClientApp();
  if (!app) {
    return null;
  }

  return getFirestore(app);
}

export function getCollectionRef(
  collectionName: CanonicalCollectionName,
): CollectionReference | null {
  const db = getFirestoreDb();
  if (!db) {
    return null;
  }

  return collection(db, collectionName);
}

export function getDocRef(
  collectionName: CanonicalCollectionName,
  id: string,
): DocumentReference | null {
  const db = getFirestoreDb();
  if (!db) {
    return null;
  }

  return doc(db, collectionName, id);
}

function parseWithId<T extends { id: string }>(
  parser: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  value: unknown,
  fallbackId: string,
): T | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const normalized = {
    ...(value as Record<string, unknown>),
    id: (value as Record<string, unknown>).id ?? fallbackId,
  };

  const parsed = parser.safeParse(normalized);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export async function readStudentProfileByUid(
  uid: string,
): Promise<{ ok: true; student: Student | null } | { ok: false; error: string }> {
  const ref = getCollectionRef("students");
  if (!ref) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const snapshot = await getDocs(query(ref, where("uid", "==", uid), limit(1)));
    const first = snapshot.docs[0];
    if (!first) {
      return { ok: true, student: null };
    }

    const student = parseWithId(studentSchema, first.data(), first.id);
    if (!student) {
      return { ok: false, error: "Student profile exists but shape is invalid." };
    }

    return { ok: true, student };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read student profile.",
    };
  }
}

export async function readStudentProfileById(
  studentId: string,
): Promise<{ ok: true; student: Student | null } | { ok: false; error: string }> {
  const ref = getDocRef("students", studentId);
  if (!ref) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      return { ok: true, student: null };
    }

    const student = parseWithId(studentSchema, snapshot.data(), snapshot.id);
    if (!student) {
      return { ok: false, error: "Student document exists but shape is invalid." };
    }

    return { ok: true, student };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read student profile.",
    };
  }
}

export async function readBusById(
  busId: string,
): Promise<{ ok: true; bus: Bus | null } | { ok: false; error: string }> {
  const ref = getDocRef("buses", busId);
  if (!ref) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      return { ok: true, bus: null };
    }

    const bus = parseWithId(busSchema, snapshot.data(), snapshot.id);
    if (!bus) {
      return { ok: false, error: "Bus document exists but shape is invalid." };
    }

    return { ok: true, bus };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read bus.",
    };
  }
}

export async function readRouteById(
  routeId: string,
): Promise<{ ok: true; route: Route | null } | { ok: false; error: string }> {
  const ref = getDocRef("routes", routeId);
  if (!ref) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      return { ok: true, route: null };
    }

    const route = parseWithId(routeSchema, snapshot.data(), snapshot.id);
    if (!route) {
      return { ok: false, error: "Route document exists but shape is invalid." };
    }

    return { ok: true, route };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read route.",
    };
  }
}

export async function readStopsForRoute(
  routeId: string,
): Promise<{ ok: true; stops: Stop[] } | { ok: false; error: string }> {
  const ref = getCollectionRef("stops");
  if (!ref) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const snapshot = await getDocs(query(ref, where("routeId", "==", routeId)));
    const stops = snapshot.docs
      .map((item) => parseWithId(stopSchema, item.data(), item.id))
      .filter((stop): stop is Stop => Boolean(stop))
      .sort((a, b) => a.order - b.order);

    return { ok: true, stops };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read stops.",
    };
  }
}

export async function readRouteAndStopsForBus(
  busId: string,
): Promise<{ ok: true; route: Route | null; stops: Stop[] } | { ok: false; error: string }> {
  const busResult = await readBusById(busId);
  if (!busResult.ok) {
    return busResult;
  }

  if (!busResult.bus) {
    return { ok: true, route: null, stops: [] };
  }

  const routeResult = await readRouteById(busResult.bus.routeId);
  if (!routeResult.ok) {
    return routeResult;
  }

  if (!routeResult.route) {
    return { ok: true, route: null, stops: [] };
  }

  const stopsResult = await readStopsForRoute(routeResult.route.id);
  if (!stopsResult.ok) {
    return stopsResult;
  }

  return {
    ok: true,
    route: routeResult.route,
    stops: stopsResult.stops,
  };
}

export async function readParentLinkByParentUid(
  parentUid: string,
): Promise<{ ok: true; parentLink: ParentLink | null } | { ok: false; error: string }> {
  const ref = getCollectionRef("parentLinks");
  if (!ref) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const snapshot = await getDocs(query(ref, where("parentUid", "==", parentUid), limit(1)));
    const first = snapshot.docs[0];
    if (!first) {
      return { ok: true, parentLink: null };
    }

    const parentLink = parseWithId(parentLinkSchema, first.data(), first.id);
    if (!parentLink) {
      return { ok: false, error: "Parent link document exists but shape is invalid." };
    }

    return { ok: true, parentLink };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read parent link.",
    };
  }
}

export async function readCollegeById(
  collegeId: string,
): Promise<{ ok: true; college: College | null } | { ok: false; error: string }> {
  const ref = getDocRef("colleges", collegeId);
  if (!ref) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      return { ok: true, college: null };
    }

    const college = parseWithId(collegeSchema, snapshot.data(), snapshot.id);
    if (!college) {
      return { ok: false, error: "College document exists but shape is invalid." };
    }

    return { ok: true, college };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read college.",
    };
  }
}

export async function readSubscriptionsByCollege(
  collegeId: string,
): Promise<{ ok: true; subscriptions: Subscription[] } | { ok: false; error: string }> {
  const ref = getCollectionRef("subscriptions");
  if (!ref) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const snapshot = await getDocs(query(ref, where("collegeId", "==", collegeId)));
    const subscriptions = snapshot.docs
      .map((item) => parseWithId(subscriptionSchema, item.data(), item.id))
      .filter((item): item is Subscription => Boolean(item));

    return { ok: true, subscriptions };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to read subscriptions.",
    };
  }
}

export async function readAdminSummaryCounts(): Promise<
  | {
      ok: true;
      summary: {
        colleges: number;
        students: number;
        buses: number;
        routes: number;
        stops: number;
        parentLinks: number;
        subscriptions: number;
      };
    }
  | { ok: false; error: string }
> {
  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const [colleges, students, buses, routes, stops, parentLinks, subscriptions] =
      await Promise.all([
        getCountFromServer(collection(db, "colleges")),
        getCountFromServer(collection(db, "students")),
        getCountFromServer(collection(db, "buses")),
        getCountFromServer(collection(db, "routes")),
        getCountFromServer(collection(db, "stops")),
        getCountFromServer(collection(db, "parentLinks")),
        getCountFromServer(collection(db, "subscriptions")),
      ]);

    return {
      ok: true,
      summary: {
        colleges: colleges.data().count,
        students: students.data().count,
        buses: buses.data().count,
        routes: routes.data().count,
        stops: stops.data().count,
        parentLinks: parentLinks.data().count,
        subscriptions: subscriptions.data().count,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read admin summary.",
    };
  }
}
