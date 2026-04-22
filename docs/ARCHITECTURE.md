# Architecture

## Overview
BusPulse uses a Firebase-first split architecture with an Intelligent Crowdsourced Fleet Tracking model.
- Firestore for canonical transport entities and access metadata.
- Realtime Database for hot presence, proximity matchmaking, and derived live bus state.

## Ground Truth & Hardware Constraints
- Bus drivers **DO NOT** have smartphones.
- The tracking model relies entirely on students.

## The "Hold The Bus" Proximity System
We utilize a bi-directional location sharing system between two student states:
1. **WAITING State**: When checking ETA, students grant location access. They are pushed to RTDB as an `ApproachingStudent`.
2. **Bus Visibility**: `BOARDED` students see the live locations of `WAITING` students. If a student is 15-20s away, the bus occupants can ask the driver to wait.
3. **BOARDED State (The Merge)**: When a `WAITING` student's GPS coordinates intersect with the derived Bus coordinates (matching velocity/trajectory), they transition to `BOARDED`.

## Battery-Optimized Consensus Tracking (Tracker Pool)
- All `BOARDED` users enter the `trackerCandidates` pool.
- **Leader Election**: A backend process (or client consensus) elects exactly ONE or TWO active devices in the bus to ping high-fidelity GPS data to `busLocations`.
- **Standby Promotion**: If the active leader's signal drops, another `BOARDED` user is instantly promoted.

## Security and Privacy
- Firebase Auth exclusively uses `signInWithRedirect` to bypass aggressive pop-up/third-party cookie blockers.
- Strictly enforce 1 active session per email via custom claims.
- **RBAC Monetization**:
  - Tier 1 (₹50/mo): Locked to assigned bus.
  - Tier 2 (God Mode - ₹500/mo): Can view any bus live location.
