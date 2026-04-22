"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bus, LogIn } from "lucide-react";

import { useAuthSession } from "@/hooks/use-auth-session";

export function LoginForm() {
  const router = useRouter();
  const { mode, isLoading, user, error, signIn } = useAuthSession();

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [router, user]);

  const isLiveAuthReady = mode === "live";
  const primaryLabel = isLiveAuthReady
    ? "Continue with Google"
    : "Open Tracker Preview";

  const handlePrimaryAction = async () => {
    if (!isLiveAuthReady) {
      router.push("/dashboard");
      return;
    }

    await signIn();
  };

  return (
    <div
      className="min-h-[100dvh] grid place-items-center px-4 bg-[#eef2f7]"
      style={{
        background: "radial-gradient(circle at 10% 15%, rgba(18,90,212,.2), transparent 36%), radial-gradient(circle at 88% 10%, rgba(0,163,122,.15), transparent 34%), #eef2f7",
      }}
    >
      <div className="w-full max-w-lg">
        <div className="border border-slate-900/10 rounded-3xl p-6 sm:p-10 backdrop-blur-md bg-white/95 shadow-xl">
          <div className="flex flex-col gap-8">
            <div className="flex flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-full grid place-items-center bg-blue-600 text-white shadow-md">
                <Bus className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">BusPulse</h1>
                <p className="text-sm text-gray-500 font-medium">Student live bus tracker</p>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-extrabold mb-2 text-gray-900">Track your bus in real time.</h2>
              <p className="text-base text-gray-600">Sign in and go straight into your assigned bus map view.</p>
            </div>

            <div className="flex flex-row items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${isLiveAuthReady ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                {isLiveAuthReady ? "Live Sign-In" : "Preview Mode"}
              </span>
            </div>

            <button
              onClick={() => handlePrimaryAction()}
              disabled={isLoading}
              className={`flex items-center justify-center gap-3 w-full py-4 px-6 rounded-full text-base font-bold text-white transition-all ${isLoading ? "opacity-70 cursor-not-allowed" : "hover:shadow-lg hover:-translate-y-0.5"} ${isLiveAuthReady ? "bg-slate-900 hover:bg-slate-800" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {isLiveAuthReady ? <LogIn className="w-5 h-5" /> : <Bus className="w-5 h-5" />}
              {primaryLabel}
            </button>

            {isLiveAuthReady && error ? (
              <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 text-orange-800 text-sm font-medium">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
