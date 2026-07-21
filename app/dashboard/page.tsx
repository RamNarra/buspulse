'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowsClockwise,
  MapPin,
  Users,
  Crosshair,
  Bus,
} from '@phosphor-icons/react';
import { doc, getFirestore, getDoc } from 'firebase/firestore';

import { AppShell } from '@/components/nav/app-shell';
import { BusMap } from '@/components/map/bus-map';
import { EtaDisplay } from '@/components/ui/eta-display';
import { StatusBadge } from '@/components/ui/badge';
import { ConfidenceBar } from '@/components/ui/confidence-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/components/auth/auth-provider';
import { useLiveBusState } from '@/hooks/use-live-bus-state';
import { useCurrentStudentProfile } from '@/hooks/use-current-student-profile';
import { useCrowdsourceTracking } from '@/hooks/use-crowdsource-tracking';
import { useAppStore } from '@/lib/store/app-store';
import { getFirebaseClientApp } from '@/lib/firebase/client';
import type { Route, Stop } from '@/types/models';

// ── Hooks ───────────────────────────────────────────────────────────────────

// Replaced local useStudentProfile with official hook imported above

function useRoute(busId: string | null) {
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!busId) { setLoading(false); return; }
      const app = getFirebaseClientApp();
      if (!app) { setLoading(false); return; }
      const db = getFirestore(app);
      try {
        const busSnap = await getDoc(doc(db, 'buses', busId));
        if (cancelled || !busSnap.exists()) { setLoading(false); return; }
        const routeId = (busSnap.data() as { routeId?: string }).routeId;
        if (!routeId) { setLoading(false); return; }
        const routeSnap = await getDoc(doc(db, 'routes', routeId));
        if (cancelled) return;
        if (routeSnap.exists()) {
          const r = routeSnap.data() as Route;
          setRoute(r);
          const stopDocs = await Promise.all(
            (r.stopIds ?? []).map((sid: string) => getDoc(doc(db, 'stops', sid))),
          );
          if (!cancelled) {
            setStops(
              stopDocs
                .filter((s) => s.exists())
                .map((s) => ({ id: s.id, ...s.data() } as Stop)),
            );
          }
        }
      } catch {
        // silent — empty stops is valid
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [busId]);

  return { route, stops, loading };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex flex-col gap-2">
        <Skeleton width={80} height={12} />
        <Skeleton width={120} height={20} />
      </div>
      <ConfidenceBar confidence={0} size="sm" showLabel={false} showPercentage={false} />
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={36} />
        ))}
      </div>
    </div>
  );
}

interface StopListProps {
  stops: Stop[];
  currentStopId?: string | null;
  busStopIndex?: number;
}

function StopList({ stops, currentStopId, busStopIndex }: StopListProps) {
  return (
    <div className="flex flex-col" role="list" aria-label="Route stops">
      {stops.map((stop, i) => {
        const isPast = busStopIndex != null && i < busStopIndex;
        const isCurrent = stop.id === currentStopId;

        return (
          <div
            key={stop.id}
            role="listitem"
            className="flex items-start gap-3 py-2.5 relative"
          >
            {/* Connector line */}
            {i < stops.length - 1 && (
              <div
                className="absolute left-[13px] top-[28px] bottom-0 w-px"
                style={{ backgroundColor: isPast ? '#00c4ff' : '#1e1e28' }}
              />
            )}

            {/* Stop circle */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10"
              style={{
                backgroundColor: isCurrent
                  ? '#00c4ff'
                  : isPast
                    ? 'rgba(0,196,255,0.1)'
                    : '#1a1a1f',
                border: isCurrent
                  ? '2px solid rgba(0,196,255,0.5)'
                  : isPast
                    ? '1px solid rgba(0,196,255,0.3)'
                    : '1px solid #252532',
              }}
            >
              <span
                className="text-[10px] font-bold"
                style={{
                  color: isCurrent ? '#0a0a0b' : isPast ? '#00c4ff' : '#4a4a5e',
                }}
              >
                {i + 1}
              </span>
            </div>

            {/* Stop name */}
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-sm font-medium truncate"
                style={{
                  color: isCurrent
                    ? '#fafafa'
                    : isPast
                      ? '#4a4a5e'
                      : '#8b8b9e',
                }}
              >
                {stop.name}
              </span>
              {isCurrent && (
                <span className="text-[10px] font-mono text-[#00c4ff]/70 mt-0.5">
                  ● Bus approaching
                </span>
              )}
            </div>

            {/* MapPin for user's stop */}
            {stop.id === currentStopId && (
              <MapPin size={14} color="#00c4ff" weight="fill" className="flex-shrink-0 mt-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ETA Bottom Panel ─────────────────────────────────────────────────────────

interface EtaPanelProps {
  routeName: string | undefined;
  busId: string | null;
  etaMinutes: number | null;
  confidence: number | null;
  lastUpdatedAt: number | null;
  health: import('@/types/models').BusHealth | null;
  stale: boolean;
  contributorCount?: number;
  onRecenter: () => void;
}

function EtaPanel({
  routeName,
  busId,
  etaMinutes,
  confidence,
  lastUpdatedAt,
  health,
  stale,
  contributorCount = 0,
  onRecenter,
}: EtaPanelProps) {
  const isOffline = !etaMinutes && contributorCount === 0;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className="absolute bottom-0 left-0 right-0 z-20"
      style={{
        background: 'rgba(10,10,11,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid #1e1e28',
      }}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        {/* Left: ETA + route name */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Bus size={14} color={isOffline ? "#ef4444" : "#8b8b9e"} />
            <span className="text-xs text-[#8b8b9e] font-medium truncate">
              {routeName ?? (busId ? `Bus ${busId}` : 'Loading…')}
            </span>
          </div>
          {isOffline ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-[#ef4444]">Bus Offline</span>
              <span className="text-xs text-[#4a4a5e]">Waiting for live sensor...</span>
            </div>
          ) : (
            <EtaDisplay
              etaMinutes={etaMinutes}
              confidence={confidence}
              lastUpdatedAt={lastUpdatedAt}
              stale={stale}
            />
          )}
        </div>

        {/* Right: health + contributors + recenter */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          {health ? (
            <StatusBadge status={health.status} />
          ) : (
            <StatusBadge status={isOffline ? "stale" : "healthy"} />
          )}
          <div className="flex items-center gap-1.5 text-xs text-[#4a4a5e]" title="Active anonymous bus sensors inside bus">
            <Users size={12} />
            <span className="font-mono">
              {contributorCount} active {contributorCount === 1 ? 'sensor' : 'sensors'}
            </span>
          </div>
          <button
            onClick={onRecenter}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs text-[#8b8b9e] transition-colors"
            style={{ background: '#1a1a1f', border: '1px solid #252532' }}
            aria-label="Recenter map on bus"
          >
            <Crosshair size={12} />
            Recenter
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthContext();
  const { triggerRecenter } = useAppStore();

  const { student, isLoading: profileLoading } = useCurrentStudentProfile(user);
  const busId = student?.busId ?? 'bus-a1'; // Default fallback to Route 15 bus
  const userStopId = student?.stopId ?? 'stop-jntuh'; // Default fallback stop

  const { route, stops, loading: routeLoading } = useRoute(busId);
  const userStop = stops.find((s) => s.id === userStopId) ?? null;

  const liveState = useLiveBusState({ busId, userStop });

  const routePath = route?.polyline ?? stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  // Use official tracking & leader election coordinator hook with off-route protection
  const { trackingState, peerCount } = useCrowdsourceTracking(stops, routePath);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // Derive nearest stop index from bus location
  const busStopIndex = liveState.location
    ? stops.reduce<number>((closest, stop, i) => {
        const d = Math.hypot(
          (liveState.location?.lat ?? 0) - stop.lat,
          (liveState.location?.lng ?? 0) - stop.lng,
        );
        const prev = stops[closest];
        const prevD = Math.hypot(
          (liveState.location?.lat ?? 0) - prev.lat,
          (liveState.location?.lng ?? 0) - prev.lng,
        );
        return d < prevD ? i : closest;
      }, 0)
    : undefined;

  const isLoading = authLoading || profileLoading;

  if (!user && !authLoading) return null; // Redirecting

  return (
    <AppShell>
      <div
        className="flex h-[calc(100dvh-56px)] overflow-hidden"
        style={{ backgroundColor: '#0a0a0b' }}
      >
        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside
          className="hidden md:flex flex-col flex-shrink-0 overflow-y-auto no-bounce"
          style={{
            width: '260px',
            backgroundColor: '#0f0f12',
            borderRight: '1px solid #1e1e28',
          }}
          aria-label="Route information"
        >
          {isLoading || routeLoading ? (
            <SidebarSkeleton />
          ) : (
            <div className="flex flex-col gap-5 p-5">
              {/* Route header */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-label mb-0">Your Route</p>
                  <span className="px-2 py-0.5 rounded-[4px] text-[9px] font-mono font-bold tracking-wide uppercase" style={{
                    backgroundColor: trackingState === 'BOARDED' ? 'rgba(34,197,94,0.1)' : 'rgba(0,196,255,0.1)',
                    color: trackingState === 'BOARDED' ? '#22c55e' : '#00c4ff',
                    border: `1px solid ${trackingState === 'BOARDED' ? 'rgba(34,197,94,0.2)' : 'rgba(0,196,255,0.2)'}`
                  }}>
                    {trackingState}
                  </span>
                </div>
                <h2 className="text-[#fafafa] font-semibold text-base leading-tight">
                  {route?.name ?? 'Unassigned'}
                </h2>
                {busId && (
                  <p className="text-xs font-mono text-[#4a4a5e] mt-1">
                    {busId.slice(0, 12).toUpperCase()}
                  </p>
                )}
              </div>

              {/* Confidence bar */}
              {liveState.confidence !== null && (
                <ConfidenceBar confidence={liveState.confidence} size="sm" />
              )}

              {/* Stops list */}
              {stops.length > 0 ? (
                <div>
                  <p className="text-label mb-2">Stops</p>
                  <StopList
                    stops={stops}
                    currentStopId={userStopId}
                    busStopIndex={busStopIndex}
                  />
                </div>
              ) : (
                <p className="text-sm text-[#4a4a5e]">No stops found.</p>
              )}
            </div>
          )}
        </aside>

        {/* ── Map + ETA Panel ─────────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-hidden">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <ArrowsClockwise
                  size={28}
                  color="#00c4ff"
                  className="animate-spin"
                />
                <p className="text-sm text-[#8b8b9e]">Loading your route…</p>
              </div>
            </div>
          ) : (
            <BusMap
              busLocation={liveState.location}
              stops={stops}
              userStopId={userStopId ?? undefined}
              stale={liveState.stale}
              confidence={liveState.confidence}
              className="h-full"
            >
              <EtaPanel
                routeName={route?.name}
                busId={busId}
                etaMinutes={liveState.etaMinutes}
                confidence={liveState.confidence}
                lastUpdatedAt={liveState.lastUpdatedAt}
                health={liveState.health}
                stale={liveState.stale}
                contributorCount={peerCount}
                onRecenter={triggerRecenter}
              />
            </BusMap>
          )}
        </div>
      </div>
    </AppShell>
  );
}