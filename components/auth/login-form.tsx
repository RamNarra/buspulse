"use client";

import { Bus, LogIn, ShieldCheck, Zap } from "lucide-react";
import { getAuth, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { useAuthContext } from "@/components/auth/auth-provider";
import { useState } from "react";

export function LoginForm() {
  const { isLoading: isAuthLoading } = useAuthContext();
  const [isClickLoading, setIsClickLoading] = useState(false);
  const [clickError, setClickError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsClickLoading(true);
    setClickError(null);

    try {
      const app = getFirebaseClientApp();
      if (!app) throw new Error("Firebase app not initialized");
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      
      console.log("[LoginForm] Calling signInWithRedirect...");
      await signInWithRedirect(auth, provider);
    } catch (error: unknown) {
      console.error("[LoginForm] Error triggering redirect:", error);
      setClickError(error instanceof Error ? error.message : "Unknown error");
      setIsClickLoading(false);
    }
  };

  const isLoading = isAuthLoading || isClickLoading;

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />

      <div className="w-full max-w-md relative z-10">
        <div className="p-[1px] rounded-[2rem] bg-gradient-to-b from-indigo-500/50 via-slate-800/50 to-slate-900/50 shadow-2xl">
          <div className="bg-slate-950/80 backdrop-blur-2xl rounded-[2rem] p-8 sm:p-10 flex flex-col items-center text-center">
            
            {/* Logo pulse effect */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-xl opacity-50 animate-pulse" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-indigo-500 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 overflow-hidden group">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                <Bus className="w-10 h-10 text-white relative z-10" />
              </div>
            </div>
            
            <div className="space-y-3 mb-10">
              <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight">
                BusPulse
              </h1>
              <p className="text-slate-400 font-medium max-w-[260px] mx-auto leading-relaxed text-sm">
                Intelligent fleet tracking powered by the student network.
              </p>
            </div>

            {clickError && (
              <div className="w-full bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-semibold flex items-start gap-3 text-left mb-6 backdrop-blur-md">
                <span className="shrink-0 text-red-500">⚠️</span>
                <p>{clickError}</p>
              </div>
            )}

            <button
              onClick={() => void handleGoogleLogin()}
              disabled={isLoading}
              className="relative w-full group overflow-hidden rounded-xl p-[1px] disabled:opacity-70 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center gap-3 bg-slate-950 px-6 py-4 rounded-xl transition-all duration-300 group-hover:bg-slate-950/50">
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-white font-bold text-sm tracking-wide">AUTHENTICATING</span>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-1 rounded-md">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <span className="text-white font-bold tracking-wide">Continue with Google</span>
                  </>
                )}
              </div>
            </button>

            <div className="w-full mt-8 pt-6 border-t border-slate-800/50 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Restricted to verified college domains</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
