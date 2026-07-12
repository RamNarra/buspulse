'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bus,
  Users,
  Clock,
} from '@phosphor-icons/react';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';

import { AppShell } from '@/components/nav/app-shell';
import { BusMap } from '@/components/map/bus-map';
import { StatusBadge } from '@/components/ui/badge';
import { EtaDisplay } from '@/components/ui/eta-display';
import { ConfidenceBar } from '@/components/ui/confidence-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/components/auth/auth-provider';
import { useLiveBusState } from '@/hooks/use-live-bus-state';
import { getFirebaseClientApp } from '@/lib/firebase/client';
import type { Student } from '@/types/models';

// ── Hooks ───────────────────────────────────────────────────────────────────

function useParentData(uid: string | null) {
  const [children, setChildren] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const app = getFirebaseClientApp();
    if (!app) { setLoading(false); return; }
    const db = getFirestore(app);
    let cancelled = false;

    // parentLinks collection: { parentId, studentId }
    getDocs(query(collection(db, 'parentLinks'), where('parentId', '==', uid)))
      .then(async (linksSnap) => {
        if (cancelled || linksSnap.empty) { setLoading(false); return; }
        const studentIds = linksSnap.docs.map((d) => d.data().studentId as string);
        const studentDocs = await Promise.all(
          studentIds.map((id) =>
            import('firebase/firestore').then(({ doc, getDoc }) =>
              getDoc(doc(db, 'students', id)),
            ),
          ),
        );
        if (!cancelled) {
          setChildren(
            studentDocs
              .filter((s) => s.exists())
              .map((s) => ({ id: s.id, ...s.data() } as Student)),
          );
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [uid]);

  return { children, loading };
}

// ── Child Bus Card ────────────────────────────────────────────────────────────

interface ChildBusCardProps {
  child: Student;
  isSelected: boolean;
  onClick: () => void;
}

function ChildBusCard({ child, isSelected, onClick }: ChildBusCardProps) {
  const liveState = useLiveBusState({
    busId: child.busId ?? null,
  });

  return (
    <motion.button
      layout
      onClick={onClick}
      className="w-full text-left p-4 rounded-[8px] transition-colors"
      style={{
        background: isSelected ? 'rgba(0,196,255,0.06)' : '#0f0f12',
        border: isSelected ? '1px solid rgba(0,196,255,0.2)' : '1px solid #1e1e28',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-[#fafafa]">
          {child.fullName ?? child.email}
        </span>
        {liveState.health && <StatusBadge status={liveState.health.status} />}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[#8b8b9e] mb-3">
        <Bus size={12} />
        <span className="font-mono">{child.busId?.slice(0, 12).toUpperCase() ?? '—'}</span>
      </div>

      {liveState.confidence !== null && (
        <ConfidenceBar confidence={liveState.confidence} size="sm" showLabel={false} />
      )}

      <div className="mt-2 flex items-center gap-1 text-[#4a4a5e] text-xs">
        <Clock size={11} />
        <span>
          {liveState.etaMinutes !== null
            ? `ETA ${liveState.etaMinutes} min`
            : liveState.stale
              ? 'Signal lost'
              : 'Calculating…'}
        </span>
      </div>
    </motion.button>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ParentPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthContext();
  const { children, loading } = useParentData(user?.uid ?? null);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // Auto-select first child when data loads (initializer pattern avoids setState-in-effect)
  const selectedChildResolved = selectedChild ?? (children.length > 0 ? children[0] : null);

  const selectedBusId = selectedChildResolved?.busId ?? null;
  const liveState = useLiveBusState({ busId: selectedBusId });

  if (!user && !authLoading) return null;

  return (
    <AppShell>
      <div
        className="flex h-[calc(100dvh-56px)] overflow-hidden"
        style={{ backgroundColor: '#0a0a0b' }}
      >
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside
          className="hidden md:flex flex-col flex-shrink-0 overflow-y-auto no-bounce gap-4 p-4"
          style={{
            width: '280px',
            backgroundColor: '#0f0f12',
            borderRight: '1px solid #1e1e28',
          }}
        >
          <div>
            <p className="text-label mb-3">Linked Students</p>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2].map((i) => <Skeleton key={i} height={100} />)}
              </div>
            ) : children.length === 0 ? (
              <div className="text-center py-8">
                <Users size={28} color="#4a4a5e" className="mx-auto mb-2" />
                <p className="text-sm text-[#4a4a5e]">No linked students found.</p>
                <p className="text-xs text-[#4a4a5e]/60 mt-1">
                  Contact your college admin to link a student.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {children.map((child) => (
                  <ChildBusCard
                    key={child.id}
                    child={child}
                    isSelected={selectedChild?.id === child.id}
                    onClick={() => setSelectedChild(child)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── Map ──────────────────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-hidden">
          {!selectedBusId ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Bus size={36} color="#1e1e28" className="mx-auto mb-3" />
                <p className="text-sm text-[#4a4a5e]">Select a student to see their bus</p>
              </div>
            </div>
          ) : (
            <BusMap
              busLocation={liveState.location}
              stops={[]}
              stale={liveState.stale}
              confidence={liveState.confidence}
              className="h-full"
            >
              {/* ETA overlay */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-0 left-0 right-0 z-20 px-5 py-4"
                style={{
                  background: 'rgba(10,10,11,0.92)',
                  backdropFilter: 'blur(16px)',
                  borderTop: '1px solid #1e1e28',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#8b8b9e] mb-1">
                      {selectedChildResolved?.fullName ?? 'Student'}&apos;s bus
                    </p>
                    <EtaDisplay
                      etaMinutes={liveState.etaMinutes}
                      confidence={liveState.confidence}
                      lastUpdatedAt={liveState.lastUpdatedAt}
                      stale={liveState.stale}
                    />
                  </div>
                  {liveState.health && (
                    <StatusBadge status={liveState.health.status} />
                  )}
                </div>
              </motion.div>
            </BusMap>
          )}
        </div>
      </div>
    </AppShell>
  );
}
