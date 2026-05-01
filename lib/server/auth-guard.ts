"use server";

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Reads the `__session` cookie set by Firebase Auth and verifies the caller
 * has the `admin` custom claim. Returns null when unauthenticated or
 * insufficiently privileged.
 *
 * Usage: call at the top of any Server Action or Route Handler that requires
 * admin privileges. Redirect to /login on null.
 */
export async function requireAdminClaim(): Promise<{
  uid: string;
  email?: string;
} | null> {
  if (!adminAuth) return null;

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("__session")?.value;
    if (!sessionToken) return null;

    const decoded = await adminAuth.verifySessionCookie(sessionToken, true);
    const claims = decoded.customClaims as Record<string, unknown> | undefined;

    if (claims?.role !== "admin") return null;

    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Verifies a raw ID token (sent from the client via Authorization header or
 * body) has the `admin` custom claim. Use this when session cookies are not
 * available (e.g. in API route handlers called from client components).
 */
export async function verifyAdminIdToken(idToken: string): Promise<{
  uid: string;
  email?: string;
} | null> {
  if (!adminAuth) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const claims = decoded.customClaims as Record<string, unknown> | undefined;

    if (claims?.role !== "admin") return null;

    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
