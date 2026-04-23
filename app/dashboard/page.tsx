"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bus, LogOut, Settings, Loader2, Navigation, Activity, Clock } from "lucide-react";

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
  const { isMenuOpen, toggleMenu, setMenuOpen } = useAppStore();
  const { student, error: studentError, isLoading: studentLoading } =
    useCurrentStudentProfile(user);

  // Initialize the crowdsourced fleet tracking system
  const { trackingState, isLeader } = useCrowdsourceTracking();
  const { fleet } = useFleetState();

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

  const busId = effectiveStudent.busId ?? mockBus.id;
  const busState = useCurrentBusState({ busId });

  if ((mode === "live" && authLoading) || studentLoading || busState.isLoading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-950">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-40 animate-pulse" />
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-lg relative z-10 border border-white/20">
              <Bus className="w-8 h-8 text-white animate-bounce" />
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span className="text-sm font-medium text-slate-200 tracking-wide">Syncing fleet data...</span>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-inner">
              <Bus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight tracking-tight">BusPulse</h1>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${trackingState === "BOARDED" ? "bg-emerald-400 animate-pulse" : trackingState === "WAITING" ? "bg-amber-400 animate-pulse" : "bg-slate-500"}`} />
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
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/settings");
                      }}
                      className="w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      Preferences
                    </button>
                    
                    {user && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut();
                        }}
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

      {/* Floating Bottom Info Card */}
      <div className="absolute bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] z-20 flex flex-col gap-4">
        
        {/* Crowdsourced Contribution Badge */}
        <div className="self-end mr-2">
          <div className="bg-slate-950/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2.5 shadow-xl">
            <span className={`relative flex h-2.5 w-2.5`}>
              {trackingState !== "IDLE" && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${trackingState === "BOARDED" ? "bg-emerald-400" : "bg-amber-400"}`}></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${trackingState === "BOARDED" ? "bg-emerald-500" : trackingState === "WAITING" ? "bg-amber-500" : "bg-slate-500"}`}></span>
            </span>
            <span className="text-[11px] font-bold text-white uppercase tracking-wider">
              {trackingState === "BOARDED" ? "GPS Synced (Boarded)" : trackingState === "WAITING" ? "Locating (Waiting)" : "Standby"}
            </span>
          </div>
        </div>

        {/* Main Status Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] border border-white/10 p-1 shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 pointer-events-none" />
          
          <div className="bg-slate-950/50 rounded-[1.8rem] p-5 relative z-10">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight mb-1">
                  {busState.bus?.code ?? mockBus.code}
                </h2>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                  <Navigation className="w-4 h-4 text-indigo-400" />
                  Route {busId}
                </div>
              </div>
              
              <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${fleet.length > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
                {fleet.length > 0 && <Activity className="w-4 h-4 animate-pulse" />}
                <span className="text-xs font-bold uppercase tracking-wider">{fleet.length > 0 ? "Fleet Live" : "No Signals"}</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 mb-4">
              <p className="text-sm text-white font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Fleet Overview Active. Tracking {fleet.length} buses nearby.
              </p>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                Active network sync
              </div>
              
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                {fleet.reduce((acc, b) => acc + b.activePingers, 0)} Total Pingers
              </div>
            </div>

            {studentError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
                Unable to verify bus assignment. Showing cached data.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}