import type { BusLocation, Stop } from "@/types/models";
import { haversineKm } from "@/lib/utils/geo";

const DEFAULT_CITY_BUS_KMPH = 22;

export function estimateEtaMinutes(
  location: BusLocation,
  stop: Stop,
  stopsPath?: Stop[],
): number {
  let distanceKm = haversineKm(location.lat, location.lng, stop.lat, stop.lng);

  // If intermediate stops path is provided, sum segment distances along path
  if (stopsPath && stopsPath.length > 1) {
    let pathDist = 0;
    let foundStart = false;
    for (let i = 0; i < stopsPath.length - 1; i++) {
      if (!foundStart) {
        pathDist += haversineKm(location.lat, location.lng, stopsPath[i].lat, stopsPath[i].lng);
        foundStart = true;
      }
      pathDist += haversineKm(stopsPath[i].lat, stopsPath[i].lng, stopsPath[i + 1].lat, stopsPath[i + 1].lng);
      if (stopsPath[i + 1].id === stop.id) break;
    }
    if (pathDist > 0) distanceKm = pathDist;
  }

  // Live speed in km/h with minimum floor
  const currentSpeedKmph = (location.speed ?? 0) * 3.6;
  
  // Traffic factor: if bus is moving slowly (< 12 km/h), apply traffic delay multiplier
  const trafficMultiplier = currentSpeedKmph > 0 && currentSpeedKmph < 12 ? 1.35 : 1.0;
  const effectiveSpeedKmph = Math.max(
    currentSpeedKmph > 5 ? currentSpeedKmph : DEFAULT_CITY_BUS_KMPH,
    5
  );

  const etaMinutes = ((distanceKm / effectiveSpeedKmph) * 60) * trafficMultiplier;

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
