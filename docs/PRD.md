# BusPulse PRD

## Problem
College transport visibility is fragmented. Students, parents, and admins need a shared near-real-time understanding of bus location and ETA without exposing sensitive contributor identity.

## Target Users
- Student rider
- Parent or guardian linked to a student (phase 2 UX)
- College transport admin (phase 2 UX)

## MVP Objectives
- Student signs in with college account and lands on an immersive map-first tracker.
- Student sees only assigned bus-level derived state with no contributor identity exposure.
- Parent and admin routes are de-emphasized and currently redirect into the student tracker.
- Live layer ingests active-session contributor updates and derives bus-level state.

## Non-Goals (MVP)
- Background tracking claims beyond active app sessions.
- Fleet orchestration systems.
- Real payment integration (subscription model is scaffolded only).

## Success Signals
- Students can open the app and quickly reach the live bus map with minimal friction.
- Setup/status guidance remains available in a lightweight settings screen.
- Another coding agent can continue implementation from docs without rediscovery.
