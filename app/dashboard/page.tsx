"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Bus, 
  LogOut, 
  Settings, 
  Loader2, 
  Navigation, 
  Activity, 
  Clock, 
  Zap, 
  Radio, 
  Crosshair, 
  WifiOff, 
  AlertOctagon, 
  CheckCircle2, 
  Sparkles, 
  Layers 
} from "lucide-react";
import { getAuth } from "firebase/auth";

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
  const { isMenuOpen, toggleMenu, setMenuOpen, triggerRecenter, mapType, setMapType } = useAppStore();
  const { student, error: studentError, isLoading: studentLoading } =
    useCurrentStudentProfile(user);

  const { trackingState, isLeader, peerCount, manualOverride, setManualOverride } = useCrowdsourceTracking();
  const busId = (student ?? mockStudent).busId ?? mockBus.id;
  const { fleet } = useFleetState();

  // AI delay explanation state
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Auto-promotion toast logic
  const prevTrackingStateRef = useRef<string>("IDLE");
  const [showAutoJoinToast, setShowAutoJoinToast] = useState(false);
  
  useEffect(() => {
    const prev = prevTrackingStateRef.current;
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

  const fetchAiExplanation = async () => {
    setIsAiLoading(true);
    setAiExplanation(null);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/explain/${busId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAiExplanation(data.explanation);
      } else {
        setAiExplanation("AI Transit Engine is currently offline.");
      }
    } catch {
      setAiExplanation("Network error fetching transit rationale.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const effectiveStudent = student ?? mockStudent;
  const accountInitial =
    user?.email?.slice(0, 1).toUpperCase() ??
    effectiveStudent.fullName.slice(0, 1).toUpperCase();
  const accountName = user?.email ?? effectiveStudent.fullName;

  const busState = useCurrentBusState({ busId });
  const myRouteBus = fleet.find((b) => b.routeNumber === busId);
  const studentsRelying = myRouteBus ? myRouteBus.activePingers - 1 : 0;

  const isBootstrapping = (mode === "live" && authLoading) || studentLoading;

  if (isBootstrapping && !busState.bus) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[#020617]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-40 animate-pulse" />
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-white/10 relative z-10">
              <Bus className="w-8 h-8 text-indigo-400 animate-bounce" />
            </div>
          </div>
          <div className="w-72 space-y-3 text-center">
            <div className="h-6 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-4 w-3/4 bg-white/5 rounded-xl animate-pulse mx-auto" />
          </div>
          <div className="flex items-center gap-2.5 bg-white/[0.04] backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">SYNCING_TELEMETRY</span>
          </div>
        </div>
      </div>
    );
  }

  const healthStatus = busState.health?.status ?? "healthy";
  const isUnhealthy = healthStatus !== "healthy" && healthStatus !== "degraded";
  const isEstimating = busState.isLoading || fleet.some((b) => b.estimated);

  return (
    <div className="h-[100dvh] w-full flex flex-col relative bg-[#020617] overflow-hidden font-sans">
      
      {/* Background Map */}
      <div className="absolute inset-0 z-0">
        <BusMap bus={busState.bus ?? mockBus} busLocation={busState.location} fleet={fleet} />
        {/* Soft overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/95 via-transparent to-[#020617]/50 pointer-events-none" />
      </div>

      {/* Floating Header */}
      <header className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-40">
        <div className="mx-auto max-w-5xl flex items-center justify-between glass-header px-4 sm:px-6 py-3 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 ${isLeader ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-indigo-500/20 border border-indigo-500/40"}`}>
              {isLeader ? <Radio className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Bus className="w-4 h-4 text-indigo-400" />}
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight font-mono">BusPulse</h1>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  trackingState === "BOARDED"
                    ? "bg-emerald-500 animate-pulse"
                    : trackingState === "WAITING"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-slate-500"
                }`} />
                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">
                  {trackingState === "BOARDED" ? (isLeader ? "GPS_LEADER" : "GPS_ACTIVE") : trackingState === "WAITING" ? "WAITING" : "STANDBY"}
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={toggleMenu}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-900 border border-white/10 text-white font-mono text-xs hover:bg-slate-800 transition-all shadow-lg"
            >
              {accountInitial}
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-slate-950/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/10 py-1.5 z-50 overflow-hidden transform origin-top-right transition-all font-mono">
                  <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Logged in as</p>
                    <p className="text-xs font-bold text-white truncate mt-0.5">{accountName}</p>
                    <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-bold uppercase tracking-wider mt-1.5">Student</span>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                      className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      System Config
                    </button>

                    {user && (
                      <button
                        onClick={() => { setMenuOpen(false); void signOut(); }}
                        className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* SLA alerts banner */}
      {isUnhealthy && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-30">
          <div className="mx-auto max-w-5xl">
            <div className={`backdrop-blur-md border rounded-2xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg ${
              healthStatus === "stranded" || healthStatus === "ghost"
                ? "bg-red-500/10 border-red-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            }`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white/5">
                {healthStatus === "ghost" || healthStatus === "offline"
                  ? <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  : <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <div className="min-w-0">
                <p className={`text-[9px] font-mono uppercase tracking-widest ${
                  healthStatus === "stranded" || healthStatus === "ghost" ? "text-red-300" : "text-amber-300"
                }`}>
                  {healthStatus === "deviated" && "⚠️ BUS_DEVIATED: GPS position extrapolated"}
                  {healthStatus === "stranded" && "🔴 BUS_STATIONARY: Confirming with driver"}
                  {healthStatus === "ghost" && "🔴 SIGNAL_STALE: Last known location shown"}
                  {healthStatus === "stale" && "⚠️ TIMEOUT: Signal delay detected"}
                  {healthStatus === "offline" && "⚠️ FLEET_OFFLINE: Telemetry inactive"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contribution override dialog */}
      {!isUnhealthy && mode === "live" && user && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-[340px]">
          <div className="glass-panel p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-white/[0.08]">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white leading-tight">Boarded Bus {busState.bus?.code ?? mockBus.code}?</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">CONTRIBUTE_TELEMETRY</p>
            </div>
            
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-white/5 relative shrink-0">
              <button 
                onClick={() => setManualOverride(false)}
                className={`relative z-10 px-3.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${manualOverride === false ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                No
              </button>
              <button 
                onClick={() => setManualOverride(true)}
                className={`relative z-10 px-3.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${manualOverride === true || trackingState === 'BOARDED' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Yes
              </button>
              <div 
                className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-indigo-500 rounded-md transition-transform duration-300 ease-out ${(manualOverride === true || (manualOverride === null && trackingState === 'BOARDED')) ? 'translate-x-[calc(100%+2px)]' : 'translate-x-0.5'}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* GPS estimation alert */}
      {!isUnhealthy && isEstimating && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-30">
          <div className="mx-auto max-w-5xl">
            <div className="bg-amber-500/5 backdrop-blur-md border border-amber-500/10 rounded-2xl px-3 py-2 flex items-center gap-2.5 shadow-lg">
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <p className="text-[9px] font-mono text-amber-300 uppercase tracking-widest">
                EXTRAPOLATING_POSITION_DEAD_RECKONING
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leader Contribution HUD */}
      {isLeader && trackingState === "BOARDED" && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-30">
          <div className="mx-auto max-w-5xl">
            <div className="bg-emerald-500/5 backdrop-blur-md border border-emerald-500/10 rounded-2xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg">
              <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
              <div className="min-w-0">
                <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">
                  🟢 CONDUIT_ACTIVE (ID: {user?.uid.slice(-4)})
                </p>
                <p className="text-[9px] text-slate-400 font-medium leading-tight mt-0.5">
                  {studentsRelying > 0
                    ? `${studentsRelying} students are receiving telemetry updates from your signal.`
                    : `Keep app active. You are currently the primary telemetry provider.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-join toast */}
      {showAutoJoinToast && (
        <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 z-50 pointer-events-none">
          <div className="mx-auto max-w-5xl">
            <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-emerald-300 uppercase tracking-widest">
                  AUTO_MERGED_SUCCESSFULLY
                </p>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                  Proximity merge completed. You are synced to bus {busId}.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Map Picker & Recenter Panel */}
      <div className="absolute top-20 right-4 sm:right-6 z-30 flex flex-col gap-2">
        <button
          onClick={triggerRecenter}
          className="w-9 h-9 rounded-full bg-slate-950/80 border border-white/10 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-500 transition-all shadow-xl"
          title="Recenter"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMapPicker(!showMapPicker)}
            className="w-9 h-9 rounded-full bg-slate-950/80 border border-white/10 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-500 transition-all shadow-xl"
            title="Map Layer"
          >
            <Layers className="w-4 h-4" />
          </button>
          
          {showMapPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMapPicker(false)} />
              <div className="absolute right-11 top-0 w-28 bg-slate-950 border border-white/10 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 font-mono text-[9px]">
                {(["roadmap", "satellite", "hybrid", "terrain"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setMapType(type); setShowMapPicker(false); }}
                    className={`px-2.5 py-1.5 rounded-lg text-left uppercase font-bold transition-all ${mapType === type ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Bottom HUD Card */}
      <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] z-20 flex flex-col gap-3">
        
        {/* Main Status Panel */}
        <div className="glass-panel rounded-3xl p-4 shadow-2xl border border-white/[0.08] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Activity className="w-20 h-20 text-white" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h2 className="text-2xl font-black font-mono text-white tracking-tight">
                  {busState.bus?.code ?? mockBus.code}
                </h2>
                <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">
                  <Navigation className="w-3 h-3 text-indigo-400" />
                  Route {busId}
                </div>
              </div>
              
              <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase ${fleet.length > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-900 border-white/5 text-slate-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${fleet.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                {fleet.length > 0 ? "Fleet_Live" : "Offline"}
              </div>
            </div>

            {/* AI Assistant Explanation Row */}
            <div className="bg-slate-950/80 rounded-2xl p-3 border border-white/5 mb-3.5">
              {aiExplanation ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    AI Transit Operator
                  </p>
                  <p className="text-xs text-slate-300 leading-normal font-medium">{aiExplanation}</p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400 font-medium">
                    {trackingState === "BOARDED" && peerCount > 0 
                      ? `${peerCount + 1} signals online in this bus.`
                      : `Awaiting delay intelligence metrics.`}
                  </p>
                  <button
                    onClick={fetchAiExplanation}
                    disabled={isAiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[9px] font-bold uppercase tracking-wider transition-all shrink-0 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isAiLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Ask AI
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[9px] font-mono uppercase tracking-wider text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-600" />
                Telemetry sync
              </div>
              <div className="text-indigo-400 font-bold">
                {fleet.reduce((acc, b) => acc + b.activePingers, 0)} Active Nodes
              </div>
            </div>

            {studentError && (
              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[9px] font-mono text-red-400 uppercase tracking-widest text-center">
                PROFILE_SYNC_ERROR
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}