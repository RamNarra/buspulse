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

### ApproachingStudent (`/approachingStudents/{busId}/{uid}`)
- **Represents WAITING state.**
- uid, lat, lng, stopId, etaToStop, distanceMeters, updatedAt.

### TrackerCandidate (`/trackerCandidates/{busId}/{uid}`)
- **Represents BOARDED state.**
- uid, lat, lng, heading, speed, accuracy, routeMatchScore, submittedAt, isLeader (boolean).

### TrackerAssignment (`/trackerAssignments/{busId}`)
- Tracks Leader Election logic.
- busId, primaryLeaderUid, secondaryLeaderUid, assignedAt, expiresAt, reason.

### BusLocation (`/busLocations/{busId}`)
- lat, lng, heading, speed, accuracy, updatedAt, confidence, sourceCount, routeMatchScore
- Viewer-facing location source (pushed only by Elected Leaders).

### BusHealth (`/busHealth/{busId}`)
- busId, status, activeContributors, staleCandidateCount, lastDerivedAt, note
