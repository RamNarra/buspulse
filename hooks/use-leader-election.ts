"use client";

import { useEffect, useRef, useState } from "react";
import { ref, onValue, runTransaction, type Database } from "firebase/database";

const STALE_PING_MS = 30_000;

export function useLeaderElection(
  db: Database | null,
  busId: string | null,
  opaqueId: string | null,
  isBoarded: boolean,
) {
  const [isLeader, setIsLeader] = useState(false);
  const isLeaderRef = useRef(false);
  const currentLeaderRef = useRef<{ uid?: string; ts?: number } | null>(null);
  const lastLeadershipRenewRef = useRef<number>(0);

  useEffect(() => {
    if (!db || !busId || !opaqueId) {
      isLeaderRef.current = false;
      Promise.resolve().then(() => {
        setIsLeader(false);
      });
      return;
    }

    const leaderRef = ref(db, `trackerAssignments/${busId}/leader`);

    const unsubLeader = onValue(leaderRef, (snapshot) => {
      const current = snapshot.val() as { uid?: string; ts?: number } | null;
      currentLeaderRef.current = current;
      const amLeader = current?.uid === opaqueId;
      isLeaderRef.current = amLeader;
      setIsLeader(amLeader);
    });

    return () => {
      unsubLeader();
    };
  }, [db, busId, opaqueId]);

  async function tryClaimLeadership(visible: boolean) {
    if (!db || !busId || !opaqueId || !isBoarded || !visible) return;

    const now = Date.now();
    const current = currentLeaderRef.current;
    const isAlreadyLeader = current?.uid === opaqueId;
    const isStale = !current?.uid || !current?.ts || (now - current.ts > STALE_PING_MS);

    if (isAlreadyLeader && (now - lastLeadershipRenewRef.current < 10_000)) {
      return;
    }

    if (!isAlreadyLeader && !isStale) {
      return;
    }

    lastLeadershipRenewRef.current = now;

    const leaderRef = ref(db, `trackerAssignments/${busId}/leader`);
    await runTransaction(leaderRef, (currentTx: { uid?: string; ts?: number } | null) => {
      const txNow = Date.now();
      if (!currentTx?.uid || !currentTx?.ts || txNow - currentTx.ts > STALE_PING_MS) {
        return { uid: opaqueId, ts: txNow };
      }
      if (currentTx.uid === opaqueId) {
        return { uid: opaqueId, ts: txNow };
      }
      return currentTx;
    });
  }

  async function yieldLeadership() {
    if (!db || !busId || !opaqueId) return;
    const leaderRef = ref(db, `trackerAssignments/${busId}/leader`);
    await runTransaction(leaderRef, (current: { uid?: string } | null) => {
      return current?.uid === opaqueId ? null : current;
    });
  }

  return {
    isLeader,
    isLeaderRef,
    tryClaimLeadership,
    yieldLeadership,
  };
}
