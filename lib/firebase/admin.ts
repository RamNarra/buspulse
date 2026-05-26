import * as admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const databaseURL =
      process.env.FIREBASE_DATABASE_URL ??
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
      (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        ? `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
        : undefined);

    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      ...(databaseURL ? { databaseURL } : {}),
    });
  } catch (error) {
    console.log("Firebase admin initialization error", error);
  }
}

export const adminDb = admin.apps.length > 0 ? admin.database() : null;
export const adminAuth = admin.apps.length > 0 ? admin.auth() : null;
export const adminFirestore = admin.apps.length > 0 ? admin.firestore() : null;
