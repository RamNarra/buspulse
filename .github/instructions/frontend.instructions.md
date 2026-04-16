# Frontend Instructions

## Goals
- Mobile-first responsive UI centered on student tracking.
- Keep placeholder UX polished and actionable.
- If maps key is missing, render graceful fallback and setup hints.

## UI Surfaces
- `/login`: form validation + sign-in placeholder
- `/dashboard`: student-only bus view + contribution status
- `/bus/[busId]`: compatibility route redirecting to `/dashboard`
- `/parent`: compatibility route redirecting to `/dashboard`
- `/admin`: compatibility route redirecting to `/dashboard`
- `/settings`: compact account + status + setup help

## Design Constraints
- Use BusPulse palette and typography from `app/globals.css`.
- Avoid exposing contributor identity in any page component.
- Keep map layer abstract; avoid tight coupling to a single map package.
