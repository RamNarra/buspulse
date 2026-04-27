# BusPulse Implementation Plan

This document outlines the strict execution of security fixes to elevate the BusPulse infrastructure to production-ready status, moving away from inherent "trust the client" vulnerabilities.

## Phase 1: Lock Down Boundaries (The "Trust No One" Phase)

### 1. Authorize Server Actions
- **File:** `app/actions/driver.ts` and `hooks/use-location-contribution.ts`
- **Fix:** Update `publishDriverLocation` to accept and verify a Firebase ID token. Verify the token resolves to a user, and verify the user string matches the candidate `uid`. Check that the user is officially assigned to the `busId` via querying the Firestore `students` collection.
- **Goal:** Prevent unauthorized clients from spoofing location data for arbitrary buses.

### 2. Fix Realtime Database Rules
- **File:** `database.rules.json`
- **Fix:** Remove blanket `.read: "auth != null"` and `.write: "auth != null"` where inappropriate.
- **Goal:** Restrict writes to only the authenticated user matching the node ID or prevent direct client writes where Server Actions are the authoritative source.

## Phase 2: Role-Based Access & Integrity (The "Admin" Phase)

### 3. Unify Terminology (god vs premium)
- **File:** `firestore.rules` and `lib/access/policies.ts`
- **Fix:** Migrate references of `premium` to `god` (or vice versa) to ensure consistency. We will standardize on `god` to match the rules text and PRD.
- **Goal:** Avoid silent access failures because of differing tier strings.

## Phase 3: Deployment and Audit
- **Files:** `CHANGELOG.md`
- **Fix:** Log all changes explicitly.
- **Goal:** Provide a traceable audit history of security remediations before pushing to Main and triggering Vercel production.
