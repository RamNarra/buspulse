# BusPulse PRD (v1.0 Scope Alignment)

## Problem
Most engineering colleges provide transport services but lack live tracking because GPS hardware installation is expensive and difficult to maintain. Students wait without knowing bus locations, parents lack ETA estimation, and transport departments receive repetitive phone calls.

## Solution
BusPulse creates a virtual GPS tracker using participating student devices acting as **anonymous bus sensors** while traveling inside the bus.

## Positioning & Ethics
- **Bus Tracking Focus**: The app is strictly marketed and presented as **tracking buses**, never tracking students.
- **Anonymous Sensors**: Student devices function purely as anonymous spatial sensors during their commute.
- **Off-Route Auto-Disconnect**: Automatic corridor detection immediately stops location contribution when a user departs the bus or route.

## Target Users
- Student rider (assigned bus tracking & arrival alerts)
- Parent or guardian (linked student bus view & ETA)
- Transport Admin / Office (fleet-wide monitoring, route management & reports)

## Core Objectives
- Authenticate via institutional Google OAuth (`signInWithRedirect`) with domain verification.
- Provide live bus map displaying moving bus marker, polyline route, ETA, and speed.
- Leader-election crowdsourcing (1 primary leader + 1 backup stream GPS, standby users heartbeat).
- Zero-knowledge privacy boundary (viewers and admins see derived `busLocations` only).
- Tiered RBAC: Base student subscription (₹50/mo) for assigned route; Enterprise Transport Office subscription (₹500/mo or institutional plan) for fleet-wide monitoring with college approval.

## Non-Goals
- Background tracking after leaving the bus/route corridor.
- Persistent individual location logging or identity tracking.
- Hardware GPS dependency (optional Pub/Sub IoT path supported in phase 2).

## Success Signals
- ETA error under 2 minutes.
- <10s location refresh rate with smooth marker interpolation.
- Instant auto-disconnect when device leaves bus route boundary.

