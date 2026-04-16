# Data Model

Target Firebase project ID: `buspulse-493407`

## Firestore Canonical Entities

### College
- id, name, code, city, emailDomains, active, timestamps

### Student
- id, uid, collegeId, fullName, email, busId, routeId, stopId, active, timestamps

### ParentLink
- id, parentUid, studentId, relationship, verified, timestamps

### Bus
- id, collegeId, routeId, code, plateNumber, capacity, active, timestamps

### Stop
- id, routeId, name, order, lat, lng, bufferMeters

### Route
- id, collegeId, name, direction, stopIds, active, timestamps

### Subscription
- id, collegeId, tier, status, seats, renewalAt, timestamps

### AccessPolicy
- uid, role, tier, allowedBusIds

## Realtime Database Live Entities

### Presence (`/presence/{uid}`)
- uid, busId, activeRouteId, deviceId, appState, lastHeartbeatAt, batteryLevel?

### TrackerCandidate (`/trackerCandidates/{busId}/{uid}`)
- uid, busId, lat, lng, heading, speed, accuracy, routeMatchScore, submittedAt, source

### TrackerAssignment (`/trackerAssignments/{busId}`)
- busId, trackerUid, assignedAt, expiresAt, reason

### BusLocation (`/busLocations/{busId}`)
- lat, lng, heading, speed, accuracy, updatedAt, confidence, sourceCount, routeMatchScore
- Viewer-facing location source (derived only)

### BusHealth (`/busHealth/{busId}`)
- busId, status, activeContributors, staleCandidateCount, lastDerivedAt, note

## Source Files
- Type contracts and schemas: `types/models.ts`
- Fixtures for UI-only dev: `lib/mock/fixtures.ts`
- Firestore wrappers: `lib/firebase/firestore.ts`
- Realtime wrappers: `lib/firebase/realtime.ts`
