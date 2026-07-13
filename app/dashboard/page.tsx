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
import { useLocationContribution } from '@/hooks/use-location-contribution';
import { useAppStore } from '@/lib/store/app-store';
import { getFirebaseClientApp } from '@/lib/firebase/client';
import type { Student, Route, Stop } from '@/types/models';

// ── Types ───────────────────────────────────────────────────────────────────

// Lightweight profile shape — no extension to avoid type conflicts
interface StudentProfile {
  busId: string | null;
  stopId: string | null;
  fullName?: string;
  email?: string;
  collegeId?: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useStudentProfile(uid: string | null) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!uid) { setProfile(null); setLoading(false); return; }
      const app = getFirebaseClientApp();
      if (!app) { setProfile(null); setLoading(false); return; }
      const db = getFirestore(app);
      try {
        const snap = await getDoc(doc(db, 'students', uid));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as Student;
          setProfile({ ...data, busId: data.busId ?? null, stopId: data.stopId ?? null });
        } else {
          setProfile({ busId: null, stopId: null });
        }
      } catch {
        if (!cancelled) setProfile({ busId: null, stopId: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [uid]);

  return { profile, loading };
}

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
  contributorCount,
  onRecenter,
}: EtaPanelProps) {
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
            <Bus size={14} color="#8b8b9e" />
            <span className="text-xs text-[#8b8b9e] font-medium truncate">
              {routeName ?? (busId ? `Bus ${busId.slice(0, 8)}` : 'Loading…')}
            </span>
          </div>
          <EtaDisplay
            etaMinutes={etaMinutes}
            confidence={confidence}
            lastUpdatedAt={lastUpdatedAt}
            stale={stale}
          />
        </div>

        {/* Right: health + contributors + recenter */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          {health && (
            <StatusBadge status={health.status} />
          )}
          {typeof contributorCount === 'number' && (
            <div className="flex items-center gap-1.5 text-xs text-[#4a4a5e]">
              <Users size={12} />
              <span className="font-mono">{contributorCount} active</span>
            </div>
          )}
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

  const { profile, loading: profileLoading } = useStudentProfile(user?.uid ?? null);
  const busId = profile?.busId ?? 'bus-a1'; // Default fallback to Route 15 bus
  const userStopId = profile?.stopId ?? 'stop-jntuh'; // Default fallback stop

  const { route, stops, loading: routeLoading } = useRoute(busId);
  const userStop = stops.find((s) => s.id === userStopId) ?? null;

  const liveState = useLiveBusState({ busId, userStop });

  // Generate unique device ID for location tracking
  const [deviceId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('buspulse_device_id');
      if (!id) {
        id = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('buspulse_device_id', id);
      }
      return id;
    }
    return 'ssr-device';
  });

  // Start broadcasting live coordinate presence
  const { start: startBroadcasting } = useLocationContribution({
    uid: user?.uid ?? '',
    busId: busId ?? '',
    routeId: route?.id ?? 'route-a1',
    deviceId,
  });

  useEffect(() => {
    if (user && busId) {
      startBroadcasting();
    }
  }, [user, busId, startBroadcasting]);

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
                <p className="text-label mb-1.5">Your Route</p>
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
                onRecenter={triggerRecenter}
              />
            </BusMap>
          )}
        </div>
      </div>
    </AppShell>
  );
}