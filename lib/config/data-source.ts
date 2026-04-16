import { getSetupDiagnostics } from "@/lib/config/env";

export type DataSourceMode = "live" | "mock";

export function getDataSourceMode(): DataSourceMode {
  const diagnostics = getSetupDiagnostics();
  return diagnostics.isReadyForLiveAuth ? "live" : "mock";
}

export function isLiveMode(): boolean {
  return getDataSourceMode() === "live";
}

export function getDataSourceReason(): string {
  const diagnostics = getSetupDiagnostics();
  if (diagnostics.isReadyForLiveAuth) {
    return "Firebase is configured for live mode.";
  }

  if (diagnostics.issues.length === 0) {
    return "Mock mode enabled.";
  }

  return diagnostics.issues.join(" | ");
}
