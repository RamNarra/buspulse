"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Navigation, 
  ShieldAlert, 
  LogOut, 
  Loader2, 
  Bus, 
  Users, 
  MapPin, 
  Compass, 
  Power, 
  BellRing,
  CheckCircle2
} from "lucide-react";
import { getDatabase, ref, onValue } from "firebase/database";

import { useAuthSession } from "@/hooks/use-auth-session";
import { useLocationContribution } from "@/hooks/use-location-contribution";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { mockBus, mockStudent } from "@/lib/mock/fixtures";

export default function DriverPage() {
  const router = useRouter();
  const { mode, user, isLoading: authLoading, signOut } = useAuthSession();
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);

  const busId = mockBus.id;
  const routeId = mockStudent.routeId;
  const contribution = useLocationContribution({
    uid: user?.uid ?? "mock-driver-uid",
    busId,
    routeId,
    deviceId: "driver-pwa",
  });

  // Dynamic Passenger & WAITING counts
  const [boardedCount, setBoardedCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [stopIndex, setStopIndex] = useState(0);

  const SNIST_STOPS = [
    { name: "SNIST Campus Depot", time: "08:10 AM" },
    { name: "Ghatkesar Cross Roads", time: "08:20 AM" },
    { name: "Peerzadiguda Hub", time: "08:35 AM" },
    { name: "Boduppal Stop", time: "08:42 AM" },
    { name: "Uppal Metro Station", time: "08:55 AM" },
  ];

  useEffect(() => {
    if (mode === "live" && !authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, mode, router, user]);

  // Listen to RTDB counts for dynamic HUD
  useEffect(() => {
    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    const boardedRef = ref(db, `trackerCandidates/${busId}`);
    const waitingRef = ref(db, `approachingStudents/${busId}`);

    const unsubBoarded = onValue(boardedRef, (snap) => {
      if (snap.exists()) {
        setBoardedCount(Object.keys(snap.val()).length);
      } else {
        setBoardedCount(0);
      }
    });

    const unsubWaiting = onValue(waitingRef, (snap) => {
      if (snap.exists()) {
        setWaitingCount(Object.keys(snap.val()).length);
      } else {
        setWaitingCount(0);
      }
    });

    return () => {
      unsubBoarded();
      unsubWaiting();
    };
  }, [busId, mode]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && contribution.isTracking) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wakeLock = await (navigator as any).wakeLock.request("screen");
          console.log("Wake Lock is active");
        }
      } catch (err: unknown) {
        setWakeLockError(`Wake Lock error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        console.log("Wake Lock released");
      }
    };

    if (contribution.isTracking) {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }

    return () => {
      void releaseWakeLock();
    };
  }, [contribution.isTracking]);

  if (mode === "live" && authLoading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[#020617]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#020617] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Nothing OS matrix dot grid background */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none" 
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }}
      />
      <div className="absolute top-[-20%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-red-500/5 blur-[120px] mix-blend-screen pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/[0.08] bg-slate-950/40 backdrop-blur-md p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
            <Bus className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight font-mono uppercase tracking-wider">Driver Cockpit</h1>
            <p className="text-[10px] text-slate-400 font-mono">NODE_BUS_{mockBus.code}</p>
          </div>
        </div>
        <button
          onClick={() => { void signOut(); router.push("/login"); }}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
        
        {/* Left column: Controls & Telemetry */}
        <div className="md:col-span-7 flex flex-col gap-6 justify-center items-center">
          
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-white/5 text-[9px] font-mono text-slate-400 uppercase tracking-widest">
              <Compass className={`w-3.5 h-3.5 ${contribution.isTracking ? "animate-spin text-indigo-400" : ""}`} />
              {contribution.isTracking ? "TRANSMITTING_TELEMETRY" : "RADIO_STANDBY"}
            </div>
            <h2 className="text-2xl font-black font-mono tracking-tight">
              {contribution.isTracking ? "GPS BEACON ON" : "START ROUTE?"}
            </h2>
          </div>

          {/* Big high-contrast touch controller dial */}
          <button
            onClick={contribution.isTracking ? contribution.stop : contribution.start}
            className={`relative w-56 h-56 rounded-full flex flex-col items-center justify-center gap-3.5 transition-all duration-500 border border-white/10 ${
              contribution.isTracking
                ? "bg-red-500/10 text-red-400 border-red-500/40 hover:bg-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.2)]"
                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/20 shadow-[0_0_60px_rgba(99,102,241,0.2)]"
            }`}
          >
            {contribution.isTracking && (
              <div className="absolute inset-0 rounded-full border border-red-500 animate-ping opacity-10"></div>
            )}
            
            <Power className="w-12 h-12" />
            <span className="text-xl font-bold font-mono uppercase tracking-widest">
              {contribution.isTracking ? "STOP" : "START"}
            </span>
          </button>

          {/* Status HUD cards */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-[340px]">
            <div className="bg-slate-950/40 border border-white/[0.08] p-3 rounded-2xl flex flex-col items-center text-center">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">GPS_SIGNAL</span>
              <span className={`text-xs font-mono font-bold mt-1 ${contribution.permissionState === "granted" ? "text-emerald-400" : "text-amber-400"}`}>
                {contribution.permissionState === "granted" ? "OPTIMAL" : contribution.permissionState === "denied" ? "BLOCKED" : "WAITING"}
              </span>
            </div>

            <div className="bg-slate-950/40 border border-white/[0.08] p-3 rounded-2xl flex flex-col items-center text-center">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">SYNC_MODE</span>
              <span className="text-xs font-mono font-bold mt-1 text-slate-300">
                {mode.toUpperCase()}
              </span>
            </div>
          </div>

          {wakeLockError && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 max-w-[340px]">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-mono text-amber-200/80 leading-normal">
                SCREEN_SLEEP_WARNING: Keep browser active to prevent signal dropouts.
              </p>
            </div>
          )}
        </div>

        {/* Right column: Route Progress & Approaching Demands */}
        <div className="md:col-span-5 flex flex-col gap-6">
          
          {/* Passenger counters */}
          <div className="bg-slate-950/30 border border-white/[0.08] p-4 rounded-2xl grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Passengers
              </span>
              <p className="text-2xl font-black font-mono">{boardedCount}</p>
              <p className="text-[8px] font-mono text-slate-400">Onboard tracking</p>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <BellRing className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Approaching
              </span>
              <p className="text-2xl font-black font-mono text-amber-400">{waitingCount}</p>
              <p className="text-[8px] font-mono text-slate-400">Waiting at stops</p>
            </div>
          </div>

          {/* Route stops list */}
          <div className="bg-slate-950/30 border border-white/[0.08] p-4 rounded-2xl flex-1 flex flex-col">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 border-b border-white/[0.06] pb-2.5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400" /> Route Stops Progress
            </h3>
            
            <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
              {SNIST_STOPS.map((stop, index) => {
                const isPassed = index < stopIndex;
                const isCurrent = index === stopIndex;
                return (
                  <div 
                    key={index}
                    onClick={() => setStopIndex(index)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isCurrent 
                        ? "bg-indigo-500/10 border-indigo-500/30 text-white" 
                        : isPassed 
                        ? "bg-slate-950/20 border-white/[0.04] text-slate-500" 
                        : "bg-slate-950/10 border-white/[0.04] text-slate-400 hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                        isCurrent 
                          ? "border-indigo-400 text-indigo-400 font-mono text-[9px] font-bold" 
                          : isPassed 
                          ? "border-emerald-500/30 text-emerald-500" 
                          : "border-slate-800 text-slate-500"
                      }`}>
                        {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : (index + 1)}
                      </div>
                      <span className={`text-xs font-semibold ${isCurrent ? "font-bold text-indigo-300" : ""}`}>
                        {stop.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{stop.time}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
