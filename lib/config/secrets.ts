// ── Secret Manager optional wrapper ──────────────────────────────────────────
// Server-side helper used by Server Actions and API routes.
//
// On Vercel: secrets are environment variables (encrypted at rest by Vercel).
// On GCP Cloud Run / Cloud Functions: use functions/src/secrets.ts which has
//   the full @google-cloud/secret-manager integration.
//
// To add Secret Manager support to this Next.js layer:
//   1. npm install @google-cloud/secret-manager
//   2. Set USE_SECRET_MANAGER=true + GCP_PROJECT_ID in production env.
//   3. Replace the env-var read below with the SecretManagerServiceClient call.

const cache = new Map<string, string>();

/**
 * Returns a secret by name.
 * Currently reads from process.env — swap this out for Secret Manager if
 * you move hosting from Vercel to Cloud Run.
 */
export async function getSecret(name: string): Promise<string | undefined> {
  if (cache.has(name)) return cache.get(name);
  const value = process.env[name];
  if (value) cache.set(name, value);
  return value;
}
