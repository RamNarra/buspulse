"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bus, LogOut, Settings, Loader2 } from "lucide-react";

import { BusMap } from "@/components/map/bus-map";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCurrentBusState } from "@/hooks/use-current-bus-state";
import { useCurrentStudentProfile } from "@/hooks/use-current-student-profile";
import { useCrowdsourceTracking } from "@/hooks/use-crowdsource-tracking";
import { mockBus, mockStudent } from "@/lib/mock/fixtures";
import { useAppStore } from "@/lib/store/app-store";

function minutesAgo(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "No recent update";
  }

  const deltaMs = Date.now() - timestamp;
  const deltaMin = Math.max(0, Math.floor(deltaMs / 60_000));
  if (deltaMin <= 0) {
    return "Updated just now";
  }

  if (deltaMin < 60) {
    return `Updated ${deltaMin} min ago`;
  }

  const deltaHours = Math.floor(deltaMin / 60);
  if (deltaHours < 24) {
    return `Updated ${deltaHours} hr ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) {
    return `Updated ${deltaDays} day${deltaDays === 1 ? "" : "s"} ago`;
  }

  return "Last updated a while ago";
}

export default function DashboardPage() {
  const router = useRouter();
  const { mode, user, isLoading: authLoading, signOut } = useAuthSession();
  const { isMenuOpen, toggleMenu, setMenuOpen } = useAppStore();
  const { student, error: studentError, isLoading: studentLoading } =
    useCurrentStudentProfile(user?.uid);

  // Initialize the crowdsourced fleet tracking system
  const { trackingState } = useCrowdsourceTracking();

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

  const liveLabel = useMemo(() => {
    if (!busState.location) {
      return "No live signal";
    }
    return busState.isStale ? "Stale" : "Live";
  }, [busState.isStale, busState.location]);

  const etaSummary = useMemo(() => {
    if (!busState.location || busState.stops.length === 0) {
      return "ETA will appear when route updates are available.";
    }

    const nextStop = busState.stops[0];
    return `Approaching ${nextStop.name}`;
  }, [busState.location, busState.stops]);

  if ((mode === "live" && authLoading) || studentLoading || busState.isLoading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[#eef2f7]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Syncing your bus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 relative">
      <header className="bg-white border-b border-slate-200 z-10">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2">
            <Bus className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">BusPulse</h1>
          </div>
          
          <div className="relative">
            <button
              onClick={toggleMenu}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-shadow"
            >
              {accountInitial}
            </button>
            
            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900 truncate">{accountName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Student tracking</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/settings");
                    }}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    Settings
                  </button>
                  
                  {user && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        void signOut();
                      }}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      Sign out
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative flex-1 min-h-0 bg-[#dce5f4]">
        <BusMap bus={busState.bus ?? mockBus} busLocation={busState.location} />

        <div className="absolute left-4 right-4 sm:left-6 sm:right-auto sm:w-96 bottom-6 p-5 rounded-3xl border border-slate-900/10 bg-white/95 backdrop-blur-md shadow-xl z-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {busState.bus?.code ?? mockBus.code}
              </h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${liveLabel === "Live" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                {liveLabel}
              </span>
            </div>

            <p className="text-sm text-slate-700 font-medium">
              {etaSummary}
            </p>

            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${trackingState === "BOARDED" ? "bg-blue-500 animate-pulse" : trackingState === "WAITING" ? "bg-amber-500" : "bg-slate-300"}`} />
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                {trackingState === "BOARDED" ? "Boarded (GPS Active)" : trackingState === "WAITING" ? "Waiting for Bus" : "Locating..."}
              </p>
            </div>

            <p className="text-xs text-slate-500">
              {minutesAgo(busState.location?.updatedAt)}
            </p>

            {studentError && (
              <p className="text-xs text-orange-600 font-medium mt-1">
                Your bus assignment could not be refreshed right now.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}