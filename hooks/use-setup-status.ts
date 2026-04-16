"use client";

import { useMemo } from "react";

import { getDataSourceMode, getDataSourceReason } from "@/lib/config/data-source";
import { getSetupDiagnostics } from "@/lib/config/env";

export function useSetupStatus() {
  return useMemo(
    () => ({
      ...getSetupDiagnostics(),
      mode: getDataSourceMode(),
      modeReason: getDataSourceReason(),
    }),
    [],
  );
}
