import type { BusLocation, Stop } from "@/types/models";
import { haversineKm } from "@/lib/utils/geo";

const DEFAULT_CITY_BUS_KMPH = 22;

export function estimateEtaMinutes(
  location: BusLocation,
  stop: Stop,
): number {
  const distanceKm = haversineKm(location.lat, location.lng, stop.lat, stop.lng);
  const speedKmph = Math.max(location.speed ?? DEFAULT_CITY_BUS_KMPH / 3.6, 1) * 3.6;
  const etaMinutes = (distanceKm / speedKmph) * 60;

  return Math.max(1, Math.round(etaMinutes));
}

export function confidenceLabel(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 0.75) {
    return "High";
  }

  if (confidence >= 0.45) {
    return "Medium";
  }

  return "Low";
}
