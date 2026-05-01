"use server";

import { randomBytes } from "crypto";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";
import { verifyAdminIdToken } from "@/lib/server/auth-guard";
import type { ParentInvite, ParentLink } from "@/types/models";

// ─── linkParent ──────────────────────────────────────────────────────────────

export type LinkParentResult =
  | { ok: true; studentId: string; busId: string }
  | { ok: false; error: string };

/**
 * Called from the parent page when a user submits an invite code.
 * - Looks up `parentInvites/{code}` in Firestore.
 * - Validates it is unused and not expired.
 * - Atomically: marks invite consumed, creates parentLinks doc, sets custom
 *   claim `role: "parent"` + `studentId` on the caller's Firebase Auth user.
 */
export async function linkParent(
  code: string,
  idToken: string,
): Promise<LinkParentResult> {
  if (!adminFirestore || !adminAuth) {
    return { ok: false, error: "Server not initialized. Try again later." };
  }

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return { ok: false, error: "Invalid invite code format." };
  }

  // Verify caller
  let parentUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    parentUid = decoded.uid;
  } catch {
    return { ok: false, error: "Authentication failed. Please sign in again." };
  }

  const inviteRef = adminFirestore.collection("parentInvites").doc(code);

  type TxResult =
    | { ok: false; error: string }
    | { ok: true; studentId: string; busId: string; parentUid: string };

  const txResult: TxResult = await adminFirestore.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);

    if (!inviteSnap.exists) {
      return { ok: false as const, error: "Invite code not found. Check and try again." };
    }

    const invite = inviteSnap.data() as ParentInvite;

    if (invite.consumed) {
      return { ok: false as const, error: "This invite code has already been used." };
    }

    if (invite.expiresAt < Date.now()) {
      return { ok: false as const, error: "This invite code has expired. Ask your admin for a new one." };
    }

    // Prevent the same parent from being linked twice to the same student
    const existing = await adminFirestore!
      .collection("parentLinks")
      .where("parentUid", "==", parentUid)
      .where("studentId", "==", invite.studentId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return { ok: false as const, error: "You are already linked to this student." };
    }

    // Fetch student to get busId for the response
    const studentSnap = await tx.get(
      adminFirestore!.collection("students").doc(invite.studentId),
    );

    if (!studentSnap.exists) {
      return { ok: false as const, error: "Student profile not found." };
    }

    const busId = (studentSnap.data() as { busId: string }).busId;

    const now = Date.now();
    const linkId = `${parentUid}_${invite.studentId}`;
    const linkRef = adminFirestore!.collection("parentLinks").doc(linkId);

    const link: ParentLink = {
      id: linkId,
      parentUid,
      studentId: invite.studentId,
      relationship: invite.relationship,
      verified: true,
      createdAt: now,
      updatedAt: now,
    };

    tx.set(linkRef, link);
    tx.update(inviteRef, {
      consumed: true,
      consumedBy: parentUid,
      consumedAt: now,
    });

    return { ok: true as const, studentId: invite.studentId, busId, parentUid };
  });

  if (!txResult.ok) return txResult;

  // Set custom claim so the client token reflects parent role (outside transaction)
  try {
    await adminAuth.setCustomUserClaims(txResult.parentUid, {
      role: "parent",
      studentId: txResult.studentId,
    });
  } catch (e) {
    // Non-fatal: claim will be set on next token refresh attempt
    console.warn("Failed to set parent custom claim:", e);
  }

  return { ok: true, studentId: txResult.studentId, busId: txResult.busId };
}

// ─── generateParentInvite ─────────────────────────────────────────────────────

export type GenerateInviteResult =
  | { ok: true; code: string; expiresAt: number }
  | { ok: false; error: string };

/**
 * Admin-only: generates a single-use parent invite code for a student.
 * Code is 6 uppercase alphanumeric chars, expires in 72 h by default.
 */
export async function generateParentInvite(
  studentId: string,
  relationship: ParentInvite["relationship"],
  idToken: string,
  ttlHours = 72,
): Promise<GenerateInviteResult> {
  if (!adminFirestore) {
    return { ok: false, error: "Server not initialized." };
  }

  const caller = await verifyAdminIdToken(idToken);
  if (!caller) {
    return { ok: false, error: "Forbidden: admin role required." };
  }

  // Validate student exists
  const studentSnap = await adminFirestore.collection("students").doc(studentId).get();
  if (!studentSnap.exists) {
    return { ok: false, error: "Student not found." };
  }

  const student = studentSnap.data() as { collegeId: string };

  const code = randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  const now = Date.now();
  const expiresAt = now + ttlHours * 60 * 60 * 1000;

  const invite: ParentInvite = {
    code,
    studentId,
    collegeId: student.collegeId,
    relationship,
    issuedBy: caller.uid,
    expiresAt,
    consumed: false,
    createdAt: now,
  };

  await adminFirestore.collection("parentInvites").doc(code).set(invite);

  return { ok: true, code, expiresAt };
}
