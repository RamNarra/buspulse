import { z } from "zod";

export const BUSPULSE_PROJECT_ID = "buspulse-493407";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
});

export type PublicRuntimeEnv = z.infer<typeof publicEnvSchema>;

const firebaseKeyOrder: (keyof PublicRuntimeEnv)[] = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
];

const mapsKeyOrder: (keyof PublicRuntimeEnv)[] = ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];

function parseEnv(): PublicRuntimeEnv {
  const rawEnv: PublicRuntimeEnv = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS:
      process.env.NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  };

  const result = publicEnvSchema.safeParse(rawEnv);
  if (result.success) {
    return result.data;
  }

  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: undefined,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: undefined,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: undefined,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: undefined,
    NEXT_PUBLIC_FIREBASE_APP_ID: undefined,
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: undefined,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: undefined,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: undefined,
    NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS: undefined,
    NEXT_PUBLIC_APP_NAME: undefined,
  };
}

function isMissing(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function missingKeys(
  env: PublicRuntimeEnv,
  keys: (keyof PublicRuntimeEnv)[],
): string[] {
  return keys.filter((key) => isMissing(env[key])).map((key) => key.toString());
}

export function getPublicRuntimeEnv(): PublicRuntimeEnv {
  return parseEnv();
}

export function getAllowedCollegeDomains(): string[] {
  const env = parseEnv();
  const raw = env.NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getSetupStatus() {
  const env = parseEnv();
  const missingFirebase = missingKeys(env, firebaseKeyOrder);
  const missingMaps = missingKeys(env, mapsKeyOrder);
  const configuredProjectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "";
  const projectIdMatchesExpected = configuredProjectId === BUSPULSE_PROJECT_ID;
  const hasAllowedDomains = getAllowedCollegeDomains().length > 0;

  return {
    appName: env.NEXT_PUBLIC_APP_NAME || "BusPulse",
    expectedProjectId: BUSPULSE_PROJECT_ID,
    configuredProjectId,
    projectIdMatchesExpected,
    hasAllowedDomains,
    firebaseReady: missingFirebase.length === 0,
    mapsReady: missingMaps.length === 0,
    missingFirebase,
    missingMaps,
  };
}

export function getSetupDiagnostics() {
  const setup = getSetupStatus();

  const issues: string[] = [];
  if (!setup.firebaseReady) {
    issues.push(`Missing Firebase values: ${setup.missingFirebase.join(", ")}`);
  }
  if (!setup.mapsReady) {
    issues.push(`Missing map value: ${setup.missingMaps.join(", ")}`);
  }
  if (!setup.projectIdMatchesExpected) {
    issues.push(
      `Project mismatch: expected ${setup.expectedProjectId}, received ${
        setup.configuredProjectId || "(empty)"
      }`,
    );
  }
  if (!setup.hasAllowedDomains) {
    issues.push("No allowed college domains configured.");
  }

  return {
    ...setup,
    issues,
    isReadyForLiveAuth: setup.firebaseReady && setup.projectIdMatchesExpected,
    isReadyForLiveMap: setup.mapsReady,
  };
}

export function getConfigError(scope: "firebase" | "maps"): string | null {
  const status = getSetupStatus();

  if (scope === "firebase" && !status.firebaseReady) {
    return `Missing Firebase env values: ${status.missingFirebase.join(", ")}`;
  }

  if (scope === "maps" && !status.mapsReady) {
    return `Missing Google Maps env values: ${status.missingMaps.join(", ")}`;
  }

  return null;
}
