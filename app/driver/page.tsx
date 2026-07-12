'use client';

/**
 * Driver page — Note: BusPulse does NOT have a driver app since bus drivers
 * don't have smartphones. This page serves as a monitoring view for the
 * crowdsourced tracking model. It shows tracking contributor status for a
 * given bus (for admin/ops use).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bus, WifiX, Users, ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link';
import {
  getDatabase,
  ref,
  onValue,
} from 'firebase/database';

import { AppShell } from '@/components/nav/app-shell';
import { StatusBadge } from '@/components/ui/badge';
import { ConfidenceBar } from '@/components/ui/confidence-bar';
import { useAuthContext } from '@/components/auth/auth-provider';
import { getFirebaseClientApp } from '@/lib/firebase/client';
import { useLiveBusState } from '@/hooks/use-live-bus-state';

interface TrackerCandidate {
  uid: string;
  accuracy: number;
  timestamp: number;
}

function useTrackerCandidates(busId: string | null) {
  const [candidates, setCandidates] = useState<TrackerCandidate[]>([]);

  useEffect(() => {
    if (!busId) return;
    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);
    const path = ref(db, `trackerCandidates/${busId}`);

    const unsub = onValue(path, (snap) => {
      if (!snap.exists()) { setCandidates([]); return; }
      const data = snap.val() as Record<string, TrackerCandidate>;
      setCandidates(Object.values(data).sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => unsub();
  }, [busId]);

  return candidates;
}

export default function DriverPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthContext();

  // In real usage, busId comes from URL params or admin config
  const [busId, setBusId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // Resolve admin's managed bus from claims
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user.getIdTokenResult().then((result) => {
      if (!cancelled) {
        const claimedBusId = result.claims?.busId as string | undefined;
        setBusId(claimedBusId ?? null);
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  const liveState = useLiveBusState({ busId });
  const candidates = useTrackerCandidates(busId);

  if (!user && !authLoading) return null;

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/admin"
            className="text-[#8b8b9e] hover:text-[#fafafa] transition-colors flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={14} />
            Admin
          </Link>
          <span className="text-[#4a4a5e]">/</span>
          <span className="text-sm text-[#fafafa]">Bus Monitor</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <Bus size={20} color="#00c4ff" />
            <h1 className="text-heading">
              {busId ? busId.slice(0, 12).toUpperCase() : 'Bus Monitor'}
            </h1>
          </div>
          <p className="text-sm text-[#8b8b9e]">
            Live crowdsourced tracking status for this bus
          </p>
        </motion.div>

        {!busId ? (
          <div
            className="p-8 rounded-[8px] text-center"
            style={{ background: '#0f0f12', border: '1px solid #1e1e28' }}
          >
            <Bus size={32} color="#4a4a5e" className="mx-auto mb-3" />
            <p className="text-sm text-[#4a4a5e]">
              No bus assigned to your account. Contact an admin.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Live status card */}
            <div
              className="p-5 rounded-[8px]"
              style={{ background: '#0f0f12', border: '1px solid #1e1e28' }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-label">Live Status</p>
                {liveState.health ? (
                  <StatusBadge status={liveState.health.status} />
                ) : (
                  <StatusBadge status="stale" />
                )}
              </div>
              {liveState.confidence !== null && (
                <ConfidenceBar confidence={liveState.confidence} />
              )}
              {liveState.location && (
                <div className="mt-3 text-xs font-mono text-[#4a4a5e]">
                  {liveState.location.lat.toFixed(5)},{' '}
                  {liveState.location.lng.toFixed(5)}
                  {' · '}
                  {liveState.location.speed != null
                    ? `${(liveState.location.speed * 3.6).toFixed(1)} km/h`
                    : 'Speed unknown'}
                </div>
              )}
            </div>

            {/* Tracker contributors */}
            <div
              className="p-5 rounded-[8px]"
              style={{ background: '#0f0f12', border: '1px solid #1e1e28' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Users size={14} color="#8b8b9e" />
                <p className="text-label">Active Contributors</p>
                <span className="ml-auto text-sm font-mono text-[#00c4ff]">
                  {candidates.length}
                </span>
              </div>
              {candidates.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-[#4a4a5e]">
                  <WifiX size={16} />
                  No active contributors — tracking unavailable
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {candidates.map((c, i) => (
                    <div
                      key={c.uid}
                      className="flex items-center gap-3 py-2 border-b border-[#1e1e28] last:border-none"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: i === 0 ? '#00c4ff' : '#22c55e' }}
                      />
                      <span className="text-xs font-mono text-[#8b8b9e]">
                        {c.uid.slice(0, 8)}…
                      </span>
                      <span className="ml-auto text-xs text-[#4a4a5e]">
                        ±{c.accuracy.toFixed(0)}m
                      </span>
                      {i === 0 && (
                        <span className="text-[10px] font-mono text-[#00c4ff] bg-[#00c4ff]/10 px-1.5 py-0.5 rounded-[3px]">
                          LEADER
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
