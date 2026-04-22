"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bus, LogIn, ShieldCheck } from "lucide-react";

import { signInWithGoogle, checkRedirectResult } from "@/lib/firebase/auth";

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for a redirect result when the component mounts
    checkRedirectResult().then((result) => {
      setIsLoading(false);
      if (result) {
        if (result.ok) {
          router.push("/dashboard");
        } else {
          setError(result.error);
        }
      }
    });
  }, [router]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    const result = await signInWithGoogle();

    if (!result.ok) {
      setError(result.error);
      setIsLoading(false);
    }
    // If ok, it will redirect, so keep loading state true
  };

  return (
    <div className="w-full max-w-md p-8 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
      
      <div className="flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 mb-2">
          <Bus className="w-8 h-8 text-white" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome to BusPulse</h1>
          <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">
            Sign in with your verified college email to view live fleet locations.
          </p>
        </div>

        {error && (
          <div className="w-full bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold border border-red-100 flex items-start gap-3 text-left">
            <span className="shrink-0">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={() => void handleGoogleLogin()}
          disabled={isLoading}
          className="relative w-full flex items-center justify-center gap-3 bg-white text-slate-700 font-bold px-6 py-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="w-full pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Access strictly restricted to verified college domains.</span>
        </div>
      </div>
    </div>
  );
}
