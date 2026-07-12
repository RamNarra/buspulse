'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bus, Users, Pulse, ChartBar } from '@phosphor-icons/react';
import {
  collection,
  getFirestore,
  onSnapshot,
} from 'firebase/firestore';

import { AppShell } from '@/components/nav/app-shell';
import { StatusBadge } from '@/components/ui/badge';
import { ConfidenceBar } from '@/components/ui/confidence-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/components/auth/auth-provider';
import { useLiveBusState } from '@/hooks/use-live-bus-state';
import { getFirebaseClientApp } from '@/lib/firebase/client';
import type { Bus as BusModel } from '@/types/models';

// ── Hook ─────────────────────────────────────────────────────────────────────

function useFleet(collegeId: string | undefined) {
  const [buses, setBuses] = useState<BusModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collegeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const app = getFirebaseClientApp();
    if (!app) {
      setLoading(false);
      return;
    }
    const db = getFirestore(app);

    const unsub = onSnapshot(
      collection(db, 'buses'),
      (snap) => {
        setBuses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BusModel)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [collegeId]);

  return { buses, loading };
}

// ── Bus Row ───────────────────────────────────────────────────────────────────

function BusRow({ bus }: { bus: BusModel }) {
  const liveState = useLiveBusState({ busId: bus.id });

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-b border-[#1e1e28]"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: liveState.stale ? '#4a4a5e' : '#22c55e',
            }}
          />
          <span className="text-sm font-mono text-[#fafafa]">
            {bus.id.slice(0, 12).toUpperCase()}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-[#8b8b9e]">{(bus as BusModel & { name?: string }).name ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        {liveState.health ? (
          <StatusBadge status={liveState.health.status} />
        ) : (
          <StatusBadge status="stale" />
        )}
      </td>
      <td className="px-4 py-3" style={{ width: '180px' }}>
        {liveState.confidence !== null ? (
          <ConfidenceBar confidence={liveState.confidence} size="sm" showLabel={false} />
        ) : (
          <span className="text-xs text-[#4a4a5e]">No signal</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {liveState.location ? (
          <span className="text-xs font-mono text-[#4a4a5e]">
            {liveState.location.lat.toFixed(4)}, {liveState.location.lng.toFixed(4)}
          </span>
        ) : (
          <span className="text-xs text-[#4a4a5e]">—</span>
        )}
      </td>
    </motion.tr>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthContext();
  const [collegeId, setCollegeId] = useState<string | undefined>();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // Resolve admin's college from claims
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user.getIdTokenResult().then((result) => {
      if (!cancelled) setCollegeId(result.claims?.collegeId as string | undefined);
    });
    return () => { cancelled = true; };
  }, [user]);

  const { buses, loading } = useFleet(collegeId);
  if (!user && !authLoading) return null;

  const totalBuses = buses.length;

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-6xl mx-auto" style={{ color: '#fafafa' }}>
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <h1 className="text-heading mb-1">Fleet Overview</h1>
          <p className="text-sm text-[#8b8b9e]">
            Real-time status of all buses in your college fleet
          </p>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Buses', value: totalBuses, icon: Bus, color: '#00c4ff' },
            { label: 'Fleet Health', value: '—', icon: Pulse, color: '#22c55e' },
            { label: 'Active Students', value: '—', icon: Users, color: '#8b5cf6' },
            { label: 'Avg. Confidence', value: '—', icon: ChartBar, color: '#f59e0b' },
          ].map(({ label, value, icon: Icon, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="p-4 rounded-[8px]"
              style={{ background: '#0f0f12', border: '1px solid #1e1e28' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color }} />
                <span className="text-label">{label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ letterSpacing: '-0.03em', color }}>
                {loading ? '—' : value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Fleet table */}
        <div
          className="rounded-[8px] overflow-hidden"
          style={{ border: '1px solid #1e1e28', background: '#0f0f12' }}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr
                className="text-left"
                style={{ borderBottom: '1px solid #1e1e28', background: '#0a0a0b' }}
              >
                {['Bus ID', 'Name', 'Status', 'Signal', 'Last Location'].map((h) => (
                  <th key={h} className="px-4 py-3 text-label">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-[#1e1e28]">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton height={16} width={`${60 + j * 10}%`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : buses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[#4a4a5e]">
                    No buses found. Contact your Firebase admin to verify data.
                  </td>
                </tr>
              ) : (
                buses.map((bus) => <BusRow key={bus.id} bus={bus} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
