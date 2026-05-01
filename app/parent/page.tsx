"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, LogOut, AlertCircle } from "lucide-react";

import { useAuthSession } from "@/hooks/use-auth-session";

export default function ParentPage() {
  const router = useRouter();
  const { signOut } = useAuthSession();
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.length < 6) return;

    setIsLoading(true);
    setError(null);

    // TODO Phase 3: replace with Server Action that verifies the invite code
    // against Firestore `parentInvites/{code}` and creates the parentLinks doc.
    await new Promise((resolve) => setTimeout(resolve, 400));
    setIsLoading(false);
    setError("Parent linking requires a valid invite code issued by your college admin. This feature is being rolled out — contact your college transport coordinator.");
  };

  return (
    <div className="min-h-[100dvh] bg-[#eef2f7] flex flex-col" style={{
      background: "radial-gradient(circle at 10% 15%, rgba(18,90,212,.1), transparent 36%), radial-gradient(circle at 88% 10%, rgba(0,163,122,.08), transparent 34%), #eef2f7",
    }}>
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 px-4 sm:px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">BusPulse Family</h1>
        </div>
        <button
          onClick={() => {
            void signOut();
            router.push("/login");
          }}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <Link2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Link Student</h2>
            <p className="text-slate-500 text-sm text-center mb-8">
              Enter the 6-digit secure code provided by your student&apos;s college to view their bus location.
            </p>

            <form onSubmit={handleLink} className="space-y-4">
              <div>
                <label htmlFor="code" className="sr-only">Invite Code</label>
                <input
                  id="code"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. A4X9B2"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl font-bold bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={inviteCode.length < 6 || isLoading}
                className={`w-full py-4 rounded-full font-bold text-white transition-all ${
                  inviteCode.length < 6 || isLoading
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-lg hover:-translate-y-0.5"
                }`}
              >
                {isLoading ? "Verifying..." : "Secure Link"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
