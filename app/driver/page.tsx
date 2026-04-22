"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation, ShieldAlert, LogOut, Loader2, Bus } from "lucide-react";

import { useAuthSession } from "@/hooks/use-auth-session";
import { useLocationContribution } from "@/hooks/use-location-contribution";
import { mockBus, mockStudent } from "@/lib/mock/fixtures";

// In a real app, the driver would select their assigned bus from Firestore.
// For now, we mock the driver's assignment to the default bus.
export default function DriverPage() {
  const router = useRouter();
  const { mode, user, isLoading: authLoading, signOut } = useAuthSession();
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);

  // We reuse useLocationContribution but in a production trusted-source model, 
  // this hook would write directly to `driverPings` or `busLocations` 
  // while students ONLY read from `busLocations`.
  const busId = mockBus.id;
  const routeId = mockStudent.routeId;
  const contribution = useLocationContribution({
    uid: user?.uid ?? "mock-driver-uid",
    busId,
    routeId,
    deviceId: "driver-pwa",
  });

  useEffect(() => {
    if (mode === "live" && !authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, mode, router, user]);

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
      <div className="min-h-[100dvh] grid place-items-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-900 text-white flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Driver Console</h1>
            <p className="text-xs text-slate-400">Bus {mockBus.code}</p>
          </div>
        </div>
        <button
          onClick={() => void signOut()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight">
            {contribution.isTracking ? "Transmitting Location" : "Ready to Drive?"}
          </h2>
          <p className="text-slate-400 max-w-sm mx-auto">
            {contribution.isTracking 
              ? "Your location is actively syncing to the cloud. Keep this screen open."
              : "Start the tracker when you begin your route to notify students."}
          </p>
        </div>

        <button
          onClick={contribution.isTracking ? contribution.stop : contribution.start}
          className={`relative group w-64 h-64 rounded-full flex flex-col items-center justify-center gap-4 transition-all duration-500 ${
            contribution.isTracking
              ? "bg-red-500/10 text-red-500 border-2 border-red-500/50 hover:bg-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.3)]"
              : "bg-blue-600 text-white border-2 border-blue-500 hover:bg-blue-500 shadow-[0_0_60px_rgba(37,99,235,0.4)]"
          }`}
        >
          {contribution.isTracking && (
            <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-20"></div>
          )}
          
          <Navigation className={`w-16 h-16 ${contribution.isTracking ? "animate-pulse" : ""}`} />
          <span className="text-2xl font-bold uppercase tracking-widest">
            {contribution.isTracking ? "Stop" : "Start"}
          </span>
        </button>

        <div className="space-y-4 w-full max-w-sm">
          <div className="bg-slate-800 rounded-2xl p-4 flex justify-between items-center border border-slate-700">
            <span className="text-slate-400 text-sm font-medium">GPS Status</span>
            <span className={`text-sm font-bold ${contribution.permissionState === "granted" ? "text-green-400" : "text-yellow-400"}`}>
              {contribution.permissionState === "granted" ? "Optimal" : contribution.permissionState === "denied" ? "Denied" : "Pending"}
            </span>
          </div>

          {wakeLockError && (
            <div className="bg-orange-500/10 border border-orange-500/50 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-200">
                {wakeLockError}. Your screen might go to sleep. Please keep the app open manually.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
