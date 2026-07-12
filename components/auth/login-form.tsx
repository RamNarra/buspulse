"use client";

import { Bus, ShieldAlert } from "lucide-react";
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
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden font-sans">
      {/* ── NOTHING OS DOT GRID ────────────────────────────────────────────── */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none" 
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      />

      {/* ── CINEMATIC NEON AMBIENT GLOWS ──────────────────────────────────── */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-500/10 blur-[130px] mix-blend-screen animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-fuchsia-600/10 blur-[130px] mix-blend-screen animate-pulse-slow pointer-events-none" style={{ animationDelay: "2s" }} />

      {/* ── CENTRAL COCKPIT CARD ─────────────────────────────────────────── */}
      <div className="w-full max-w-[420px] relative z-10">
        <div className="glass-panel rounded-3xl p-8 sm:p-10 shadow-2xl relative border border-white/[0.08] overflow-hidden group">
          {/* Top decorative red/white status bar */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-500 via-indigo-500 to-fuchsia-500 opacity-60" />
          
          <div className="flex flex-col items-center text-center">
            
            {/* Monospace System Header */}
            <div className="font-mono text-[10px] tracking-[0.25em] text-indigo-400 font-bold mb-6 uppercase">
              {"// TRANSIT_NETWORK_AUTHENTICATION"}
            </div>

            {/* Glowing System Icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/30 rounded-2xl blur-lg opacity-60 animate-pulse" />
              <div className="relative w-16 h-16 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
                <Bus className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <div className="space-y-2.5 mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-white font-mono">
                BusPulse<span className="text-red-500 animate-pulse">.</span>
              </h1>
              <p className="text-slate-400 text-xs max-w-[280px] mx-auto leading-relaxed">
                Crowdsourced transit mapping powered by student telemetry. Secure login required.
              </p>
            </div>

            {clickError && (
              <div className="w-full bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3.5 rounded-2xl text-xs font-mono flex items-start gap-2.5 text-left mb-6 backdrop-blur-md">
                <ShieldAlert className="shrink-0 text-red-400 w-4 h-4 mt-0.5" />
                <div>
                  <div className="font-bold uppercase text-[10px] tracking-wide mb-0.5">Sync error:</div>
                  <p className="leading-normal">{clickError}</p>
                </div>
              </div>
            )}

            {/* Sign in Button */}
            <button
              onClick={() => void handleGoogleLogin()}
              disabled={isLoading}
              className="relative w-full group overflow-hidden rounded-2xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {/* Glowing Frame Border */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative flex items-center justify-center gap-3 bg-slate-950 px-6 py-4 rounded-2xl transition-all duration-300 group-hover:bg-slate-950/60">
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-indigo-300 font-mono text-xs font-bold tracking-widest uppercase">CONNECTING...</span>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-1 rounded-md shrink-0">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <span className="text-white font-mono text-xs font-bold tracking-widest uppercase">Sign In with Google</span>
                  </>
                )}
              </div>
            </button>

            {/* Whitelisted domains details */}
            <div className="w-full mt-8 pt-6 border-t border-white/[0.06] flex flex-col items-center gap-2">
              <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">VERIFIED_DOMAINS</span>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-[280px]">
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-white/5 text-[9px] text-slate-400 font-mono">
                  sreenidhi.edu.in
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-white/5 text-[9px] text-slate-400 font-mono">
                  cse.sreenidhi.edu.in
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-white/5 text-[9px] text-slate-400 font-mono">
                  *sreenidhi.edu.in
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
