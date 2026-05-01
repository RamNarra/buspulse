// ── Secret Manager wrapper for Cloud Functions ────────────────────────────────
// Mirrors lib/config/secrets.ts but for the functions/ package.
// Usage:  const key = await getSecret("GOOGLE_MAPS_SERVER_KEY");

type SmClient = {
  accessSecretVersion: (req: { name: string }) => Promise<[{ payload: { data: Buffer | string } }]>;
};

let client: SmClient | null = null;
let attempted = false;

async function getClient(): Promise<SmClient | null> {
  if (attempted) return client;
  attempted = true;
  if (process.env.USE_SECRET_MANAGER !== "true") return null;
  try {
    const { SecretManagerServiceClient } = await import(
      /* webpackIgnore: true */ "@google-cloud/secret-manager"
    );
    client = new SecretManagerServiceClient() as unknown as SmClient;
    return client;
  } catch {
    return null;
  }
}

const cache = new Map<string, string>();

export async function getSecret(name: string): Promise<string | undefined> {
  if (cache.has(name)) return cache.get(name);
  const sm = await getClient();
  if (sm) {
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
    if (projectId) {
      try {
        const [v] = await sm.accessSecretVersion({
          name: `projects/${projectId}/secrets/${name}/versions/latest`,
        });
        const val = v.payload.data.toString();
        cache.set(name, val);
        return val;
      } catch { /* fall through */ }
    }
  }
  const envVal = process.env[name];
  if (envVal) cache.set(name, envVal);
  return envVal;
}
