"use client";

import { useEffect, useRef, useState } from "react";

export type InterpolatedPosition = {
  lat: number;
  lng: number;
  /** Smoothed bearing in degrees [0, 360). undefined until two fixes arrive. */
  heading?: number;
};

/**
 * Given a stream of position fixes (lat, lng, heading, updatedAt), returns a
 * `requestAnimationFrame`-driven interpolated position that glides smoothly
 * between consecutive fixes — the "Uber-feel" bus marker.
 *
 * - Linear interpolation for lat/lng
 * - Shortest-arc interpolation for heading (avoids 350° → 10° wrap-around)
 * - Animation duration = time between the last two fixes, capped [1 s, 5 s]
 */
export function useInterpolatedPosition(
  target: (InterpolatedPosition & { updatedAt: number }) | null,
): InterpolatedPosition | null {
  const prevRef = useRef<(InterpolatedPosition & { updatedAt: number }) | null>(null);
  const rafRef = useRef<number | null>(null);

  const [pos, setPos] = useState<InterpolatedPosition | null>(
    target ? { lat: target.lat, lng: target.lng, heading: target.heading } : null,
  );

  useEffect(() => {
    // Cancel any in-flight animation from the previous fix
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPos(null);
      prevRef.current = null;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = { ...target };

    // First fix or position unchanged — snap directly
    if (!prev || (prev.lat === target.lat && prev.lng === target.lng)) {
      setPos({ lat: target.lat, lng: target.lng, heading: target.heading });
      return;
    }

    // Animate from prev → target over the inter-fix interval, capped 1–5 s
    const duration = Math.min(5_000, Math.max(1_000, target.updatedAt - prev.updatedAt));
    const startTs = Date.now();

    const fromLat = prev.lat;
    const fromLng = prev.lng;
    const fromH = prev.heading;
    const toLat = target.lat;
    const toLng = target.lng;
    const toH = target.heading;

    const tick = () => {
      const t = Math.min(1, (Date.now() - startTs) / duration);

      // Ease-out cubic: feels natural, mimics vehicle deceleration
      const ease = 1 - Math.pow(1 - t, 3);

      let heading: number | undefined;
      if (fromH != null && toH != null) {
        // Shortest-arc heading interpolation
        const diff = ((toH - fromH + 540) % 360) - 180;
        heading = (fromH + diff * ease + 360) % 360;
      } else {
        heading = toH;
      }

      setPos({
        lat: fromLat + (toLat - fromLat) * ease,
        lng: fromLng + (toLng - fromLng) * ease,
        heading,
      });

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target]);

  return pos;
}
