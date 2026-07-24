import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";
import studentsDataRaw from "@/lib/data/students.json";
import { getAllowedCollegeDomains } from "@/lib/config/env";

const studentsData = studentsDataRaw as Record<string, string>;

export async function POST(req: NextRequest) {
  if (!adminAuth || !adminFirestore) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured." },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization header is missing or malformed." },
      { status: 401 }
    );
  }

  const idToken = authHeader.substring(7);
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    if (!email) {
      return NextResponse.json(
        { error: "Email is missing from the authentication token." },
        { status: 400 }
      );
    }

    let role = "student";
    let assignedBusId = "";
    let tier = "base";

    // 1. Identify Role
    if (email === "ramcharannarra8@gmail.com") {
      role = "admin";
      tier = "god";
    } else {
      // Check if they are linked as a parent in Firestore
      const parentLinkSnap = await adminFirestore
        .collection("parentLinks")
        .where("parentUid", "==", uid)
        .limit(1)
        .get();

      if (!parentLinkSnap.empty) {
        role = "parent";
        const parentLinkData = parentLinkSnap.docs[0].data();
        const studentId = parentLinkData.studentId;

        // Retrieve student's assigned bus ID
        const studentSnap = await adminFirestore
          .collection("students")
          .doc(studentId)
          .get();

        if (studentSnap.exists) {
          assignedBusId = studentSnap.data()?.busId ?? "";
        }
      } else {
        // Handle Student check
        const studentSnap = await adminFirestore
          .collection("students")
          .where("uid", "==", uid)
          .limit(1)
          .get();

        let studentData;
        if (studentSnap.empty) {
          // Fallback to students.json lookup - verify email domain first
          const allowedDomains = getAllowedCollegeDomains();
          const domain = email.split("@")[1]?.toLowerCase() ?? "";
          const isAllowedDomain = allowedDomains.includes(domain);

          const rollNoMatch = email.split("@")[0].toLowerCase();
          const routeId = isAllowedDomain ? studentsData[rollNoMatch] : undefined;

          if (routeId) {
            studentData = {
              uid,
              collegeId: "snist-01",
              fullName: `Student (${rollNoMatch.toUpperCase()})`,
              email,
              busId: routeId,
              routeId: `route-${routeId}`,
              stopId: "stop-unknown",
              active: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            // Create student profile in Firestore
            await adminFirestore
              .collection("students")
              .doc(`student-${uid}`)
              .set(studentData);
          }
        } else {
          studentData = studentSnap.docs[0].data();
        }

        if (studentData) {
          const rawBusId = studentData.busId ?? "";
          assignedBusId = rawBusId ? (rawBusId.startsWith("bus-a") ? rawBusId : `bus-a${rawBusId}`) : "";
        }
      }
    }

    // 2. Set Custom User Claims
    const customClaims = {
      role,
      assignedBusId,
      tier,
    };
    await adminAuth.setCustomUserClaims(uid, customClaims);

    return NextResponse.json({
      success: true,
      uid,
      email,
      ...customClaims,
    });
  } catch (err) {
    console.error("[auth/sync] Claims sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
