"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bus, LogOut, Settings, Loader2, Navigation, Activity, Clock, Zap, Radio, Crosshair, WifiOff, AlertOctagon, CheckCircle2 } from "lucide-react";

import { BusMap } from "@/components/map/bus-map";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCurrentBusState } from "@/hooks/use-current-bus-state";
import { useCurrentStudentProfile } from "@/hooks/use-current-student-profile";
import { useCrowdsourceTracking } from "@/hooks/use-crowdsource-tracking";
import { useFleetState } from "@/hooks/use-fleet-state";
import { mockBus, mockStudent } from "@/lib/mock/fixtures";
import { useAppStore } from "@/lib/store/app-store";

export default function DashboardPage() {
  const router = useRouter();
  const { mode, user, isLoading: authLoading, signOut } = useAuthSession();
  const { isMenuOpen, toggleMenu, setMenuOpen, triggerRecenter } = useAppStore();
  const { student, error: studentError, isLoading: studentLoading } =
    useCurrentStudentProfile(user);

  const { trackingState, isLeader, peerCount, manualOverride, setManualOverride } = useCrowdsourceTracking();
  const busId = (student ?? mockStudent).busId ?? mockBus.id;
  const { fleet } = useFleetState(); // GLOBAL BUS VISIBILITY OVERRIDE

  // ── Auto-promotion toast ────────────────────────────────────────────────────
  // Show a toast when the user auto-transitions to BOARDED without clicking "Yes".
  const prevTrackingStateRef = useRef<string>("IDLE");
  const [showAutoJoinToast, setShowAutoJoinToast] = useState(false);
  useEffect(() => {
    const prev = prevTrackingStateRef.current;
    // Auto-promotion detected: was WAITING, now BOARDED, and user did NOT click "Yes"
    if (prev === "WAITING" && trackingState === "BOARDED" && manualOverride !== true) {
      setTimeout(() => setShowAutoJoinToast(true), 0);
    }
    prevTrackingStateRef.current = trackingState;
  }, [trackingState, manualOverride]);

  useEffect(() => {
    if (showAutoJoinToast) {
      const timer = setTimeout(() => setShowAutoJoinToast(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showAutoJoinToast]);

  useEffect(() => {
    if (mode === "live" && !authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, mode, router, user]);

  const effectiveStudent = student ?? mockStudent;
  const accountInitial =
    user?.email?.slice(0, 1).toUpperCase() ??
    effectiveStudent.fullName.slice(0, 1).toUpperCase();
  const accountName = user?.email ?? effectiveStudent.fullName;

  const busState = useCurrentBusState({ busId });

  // Total students being served by this user's signal (all pingers on their route)
  const myRouteBus = fleet.find((b) => b.routeNumber === busId);
  const studentsRelying = myRouteBus ? myRouteBus.activePingers - 1 : 0; // minus self

  // Skeleton state: show when auth or student profile is loading
  // (map still renders below; only the overlays are skeletonised)
  const isBootstrapping = (mode === "live" && authLoading) || studentLoading;

  if (isBootstrapping && !busState.bus) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-950">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-40 animate-pulse" />
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-lg relative z-10 border border-white/20">
              <Bus className="w-8 h-8 text-white animate-bounce" />
            </div>
          </div>
          {/* Skeleton panels */}
          <div className="w-72 space-y-3">
            <div className="h-8 bg-white/10 rounded-xl animate-pulse" />
            <div className="h-5 w-3/4 bg-white/8 rounded-xl animate-pulse" />
            <div className="h-16 bg-white/6 rounded-2xl animate-pulse" />
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span className="text-sm font-medium text-slate-200 tracking-wide">Syncing fleet data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Derive health status for the amber / red GPS banner
  const healthStatus = busState.health?.status ?? "healthy";
  const isUnhealthy = healthStatus !== "healthy" && healthStatus !== "degraded";
  const isEstimating = busState.isLoading || fleet.some((b) => b.estimated);

  return (
    <div className="h-[100dvh] w-full flex flex-col relative bg-slate-900 overflow-hidden font-sans">

      {/* Map Layer (Background) */}
      <div className="absolute inset-0 z-0">
        <BusMap bus={busState.bus ?? mockBus} busLocation={busState.location} fleet={fleet} />
        {/* Subtle Map Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/80 pointer-events-none" />
      </div>

      {/* Floating Header */}
      <header className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-40">
        <div className="mx-auto max-w-5xl flex items-center justify-between bg-slate-950/70 backdrop-blur-xl border border-white/10 px-4 sm:px-6 py-3 rounded-3xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-all duration-500 ${isLeader ? "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/40" : "bg-gradient-to-br from-indigo-500 to-fuchsia-600"}`}>
              {isLeader ? <Radio className="w-5 h-5 text-white animate-pulse" /> : <Bus className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight tracking-tight">BusPulse</h1>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  trackingState === "BOARDED"
                    ? "bg-emerald-400 animate-pulse"
                    : trackingState === "WAITING"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-slate-500"
                }`} />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  {trackingState === "BOARDED"
                    ? isLeader ? "GPS Leader" : "GPS Synced"
                    : trackingState === "WAITING" ? "Waiting" : "Idle"}
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={toggleMenu}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-slate-800 border-2 border-slate-700 text-white font-bold text-sm hover:border-indigo-500 hover:bg-slate-700 transition-all focus:outline-none shadow-lg"
            >
              {accountInitial}
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-3 w-64 bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 py-2 z-50 overflow-hidden transform origin-top-right transition-all">
                  <div className="px-5 py-4 border-b border-white/5 bg-white/5">
                    <p className="text-sm font-bold text-white truncate">{accountName}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">Student</span>
                    </div>
                  </div>

                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                      className="w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      Preferences
                    </button>

                    {user && (
                      <button
                        onClick={() => { setMenuOpen(false); void signOut(); }}
                        className="w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── GPS HEALTH ALERT BANNER ─────────────────────────────────────────── */}
      {isUnhealthy && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-30">
          <div className="mx-auto max-w-5xl">
            <div className={`backdrop-blur-md border rounded-2xl px-3 py-2 flex items-center gap-3 shadow-lg ${
              healthStatus === "stranded" || healthStatus === "ghost"
                ? "bg-red-500/10 border-red-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                healthStatus === "stranded" || healthStatus === "ghost"
                  ? "bg-red-500/20"
                  : "bg-amber-500/20"
              }`}>
                {healthStatus === "ghost" || healthStatus === "offline"
                  ? <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  : <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-widest ${
                  healthStatus === "stranded" || healthStatus === "ghost" ? "text-red-300" : "text-amber-300"
                }`}>
                  {healthStatus === "deviated" && "⚠️ Bus may be off-route — GPS extrapolating"}
                  {healthStatus === "stranded" && "🔴 Bus appears stationary — confirming with driver"}
                  {healthStatus === "ghost" && "🔴 GPS signal lost — last known position shown"}
                  {healthStatus === "stale" && "⚠️ GPS signal is stale — position may be delayed"}
                  {healthStatus === "offline" && "⚠️ Bus signal offline — contact college transport"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {/* MANUAL OVERRIDE TOGGLE */}
      {!isUnhealthy && mode === "live" && user && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-sm">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white leading-tight">Are you in the bus?</p>
              <p className="text-xs text-slate-400 font-medium">Help track the bus location</p>
            </div>
            
            <div className="flex bg-slate-800 rounded-full p-1 border border-white/5 relative">
              <button 
                onClick={() => setManualOverride(false)}
                className={`relative z-10 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${manualOverride === false ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                No
              </button>
              <button 
                onClick={() => setManualOverride(true)}
                className={`relative z-10 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${manualOverride === true || trackingState === 'BOARDED' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Yes
              </button>
              {/* Highlight Pill */}
              <div 
                className={`absolute top-1 bottom-1 w-1/2 bg-indigo-500 rounded-full transition-transform duration-300 ease-out ${(manualOverride === true || (manualOverride === null && trackingState === 'BOARDED')) ? 'translate-x-full' : 'translate-x-0'}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Estimation notice (dead reckoning) */}
      {!isUnhealthy && isEstimating && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-30">
          <div className="mx-auto max-w-5xl">
            <div className="bg-amber-500/8 backdrop-blur-md border border-amber-500/15 rounded-2xl px-3 py-2 flex items-center gap-3 shadow-lg">
              <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              </div>
              <p className="text-[10px] font-black text-amber-300/80 uppercase tracking-widest">
                GPS syncing — extrapolating position
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO LEADER BANNER ────────────────────────────────────────────────── */}
      {isLeader && trackingState === "BOARDED" && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-30">
          <div className="mx-auto max-w-5xl">
            <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 rounded-2xl px-3 py-2 flex items-center gap-3 shadow-lg shadow-emerald-900/10 animate-pulse-slow">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                  🟢 Powering {busId} Radar (ID: {user?.uid.slice(-4)})
                </p>
                <p className="text-[9px] text-emerald-400/70 font-medium leading-tight">
                  {studentsRelying > 0
                    ? `${studentsRelying} other student${studentsRelying === 1 ? "" : "s"} on this route are relying on your signal.`
                    : `Keep screen on — you are the sole GPS source for this route.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FIRST BOARDER BANNER ─────────────────────────────────────────────── */}
      {/* Shown when user manually said "Yes" and they are the only active pinger */}
      {trackingState === "BOARDED" && manualOverride === true && peerCount === 0 && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-30">
          <div className="mx-auto max-w-5xl">
            <div className="bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 rounded-2xl px-3 py-2 flex items-center gap-3 shadow-lg">
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                  🚌 You&apos;re the first signal on Bus {busId}!
                </p>
                <p className="text-[9px] text-indigo-400/70 font-medium leading-tight">
                  Students nearby will auto-join when the bus moves.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AUTO-JOIN TOAST ──────────────────────────────────────────────────── */}
      {showAutoJoinToast && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-50 pointer-events-none">
          <div className="mx-auto max-w-5xl">
            <div className="bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
              <div className="w-8 h-8 rounded-full bg-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">
                  Welcome aboard! ✅
                </p>
                <p className="text-[9px] text-emerald-400/70 font-medium leading-tight">
                  Bus {busId} detected nearby — auto-confirmed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Info Card */}
      <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] z-20 flex flex-col gap-3">
        
        <div className="flex items-center justify-between gap-3">
          {/* Recenter Button */}
          <button
            onClick={triggerRecenter}
            className="w-10 h-10 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-500 transition-all shadow-xl"
            title="Recenter Map"
          >
            <Crosshair className="w-5 h-5" />
          </button>

          {/* Crowdsourced Contribution Badge */}
          <div className="bg-slate-950/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl">
            <span className="relative flex h-2 w-2">
              {trackingState !== "IDLE" && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${trackingState === "BOARDED" ? "bg-emerald-400" : "bg-amber-400"}`}></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${trackingState === "BOARDED" ? "bg-emerald-500" : trackingState === "WAITING" ? "bg-amber-500" : "bg-slate-500"}`}></span>
            </span>
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">
              {trackingState === "BOARDED" ? "GPS Synced" : trackingState === "WAITING" ? "Locating" : "Standby"}
            </span>
          </div>
        </div>

        {/* Main Status Card (Condensed) */}
        <div className="bg-slate-900/70 backdrop-blur-2xl rounded-3xl border border-white/10 p-0.5 shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-fuchsia-500/5 pointer-events-none" />
          
          <div className="bg-slate-950/40 rounded-[1.4rem] p-4 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
                  {busState.bus?.code ?? mockBus.code}
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  <Navigation className="w-3 h-3 text-indigo-400" />
                  Route {busId}
                </div>
              </div>
              
              <div className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 ${fleet.length > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
                <Activity className={`w-3 h-3 ${fleet.length > 0 ? "animate-pulse" : ""}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">{fleet.length > 0 ? "Live" : "Offline"}</span>
              </div>
            </div>

            {/* Simplified status line */}
            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 mb-3">
              <p className="text-[11px] text-white font-semibold flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${trackingState === "BOARDED" ? "bg-emerald-500" : "bg-indigo-500"} animate-pulse`} />
                {trackingState === "BOARDED" && peerCount > 0 
                  ? `${peerCount + 1} students detected on this bus.`
                  : `Tracking ${fleet.length} active fleet signals.`}
              </p>
              {fleet.some((b) => b.estimated) && (
                <p className="text-[9px] text-amber-400/70 font-medium mt-1 pl-3.5">
                  ⚠️ Some signals estimated.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase">
                <Clock className="w-3 h-3" />
                Network Sync Active
              </div>
              
              <div className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md uppercase tracking-widest">
                {fleet.reduce((acc, b) => acc + b.activePingers, 0)} Total Nodes
              </div>
            </div>

            {studentError && (
              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[9px] text-red-400 font-bold uppercase tracking-tight">
                Profile Sync Error
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}