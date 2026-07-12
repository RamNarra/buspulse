"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Link2, 
  LogOut, 
  AlertCircle, 
  CheckCircle2, 
  Bus, 
  Navigation, 
  Activity, 
  Clock, 
  Sparkles, 
  Loader2, 
  User, 
  ShieldCheck 
} from "lucide-react";
import { getAuth } from "firebase/auth";

import { BusMap } from "@/components/map/bus-map";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCurrentBusState } from "@/hooks/use-current-bus-state";
import { useFleetState } from "@/hooks/use-fleet-state";
import { readParentLinkByParentUid, readStudentProfileById } from "@/lib/firebase/firestore";
import { linkParent } from "@/app/actions/parent";
import type { ParentLink, Student } from "@/types/models";
import { mockBus } from "@/lib/mock/fixtures";

export default function ParentPage() {
  const router = useRouter();
  const { mode, user, isLoading: authLoading, signOut } = useAuthSession();
  
  const [inviteCode, setInviteCode] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  
  // Linked states
  const [parentLink, setParentLink] = useState<ParentLink | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // AI delay explanation state
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Load parent links if signed in
  useEffect(() => {
    let isMounted = true;
    
    async function checkLink() {
      if (!user) {
        setIsLoadingProfile(false);
        return;
      }
      setIsLoadingProfile(true);
      try {
        const linkResult = await readParentLinkByParentUid(user.uid);
        if (linkResult.ok && linkResult.parentLink) {
          if (isMounted) setParentLink(linkResult.parentLink);
          
          // Get student details
          const studentResult = await readStudentProfileById(linkResult.parentLink.studentId);
          if (studentResult.ok && studentResult.student) {
            if (isMounted) setStudent(studentResult.student);
          }
        }
      } catch (err) {
        console.error("Failed to load parent link details", err);
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }
    }

    if (!authLoading) {
      void checkLink();
    }

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // Auth gate
  useEffect(() => {
    if (mode === "live" && !authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, mode, router, user]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.length < 6) return;

    setLinkLoading(true);
    setLinkError(null);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLinkError("Authentication required. Please sign in again.");
        setLinkLoading(false);
        return;
      }

      const idToken = await currentUser.getIdToken();
      const result = await linkParent(inviteCode.trim().toUpperCase(), idToken);

      if (!result.ok) {
        setLinkError(result.error);
      } else {
        // Refresh token to apply parent claims
        await currentUser.getIdToken(true);
        
        // Reload link details
        const linkResult = await readParentLinkByParentUid(currentUser.uid);
        if (linkResult.ok && linkResult.parentLink) {
          setParentLink(linkResult.parentLink);
          const studentResult = await readStudentProfileById(linkResult.parentLink.studentId);
          if (studentResult.ok && studentResult.student) {
            setStudent(studentResult.student);
          }
        }
      }
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLinkLoading(false);
    }
  };

  const fetchAiExplanation = async () => {
    if (!student?.busId) return;
    setIsAiLoading(true);
    setAiExplanation(null);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/explain/${student.busId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAiExplanation(data.explanation);
      } else {
        setAiExplanation("AI Operator is currently offline.");
      }
    } catch {
      setAiExplanation("Network error fetching delay explanation.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Setup live bus subscriptions for the linked student's bus
  const targetBusId = student?.busId ?? "unknown";
  const busState = useCurrentBusState({ busId: targetBusId });
  const { fleet } = useFleetState(targetBusId);

  const isBootstrapping = authLoading || isLoadingProfile;

  if (isBootstrapping) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[#020617]">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">LOADING_WORKSPACE</span>
        </div>
      </div>
    );
  }

  // Render parent dashboard if linked
  if (parentLink && student) {
    return (
      <div className="h-[100dvh] w-full flex flex-col relative bg-[#020617] overflow-hidden font-sans">
        {/* Background Map */}
        <div className="absolute inset-0 z-0">
          <BusMap bus={busState.bus ?? mockBus} busLocation={busState.location} fleet={fleet} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/95 via-transparent to-[#020617]/50 pointer-events-none" />
        </div>

        {/* Floating Header */}
        <header className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-40">
          <div className="mx-auto max-w-5xl flex items-center justify-between glass-header px-4 sm:px-6 py-3 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/20 border border-indigo-500/40">
                <Link2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight font-mono">BusPulse Family</h1>
                <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">
                  RELATIONSHIP: {parentLink.relationship.toUpperCase()}
                </p>
              </div>
            </div>

            <button
              onClick={() => { void signOut(); router.push("/login"); }}
              className="w-9 h-9 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-lg"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Floating Bottom Card */}
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] z-20 flex flex-col gap-3">
          <div className="glass-panel rounded-3xl p-4 shadow-2xl border border-white/[0.08] relative">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <span className="text-[8px] font-mono text-indigo-400 uppercase tracking-widest font-bold">tracking student</span>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5 mt-0.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  {student.fullName}
                </h2>
              </div>
              <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-mono font-bold uppercase tracking-wider">
                Bus {student.busId}
              </div>
            </div>

            {/* AI explanation segment */}
            <div className="bg-slate-950/80 rounded-2xl p-3 border border-white/5 mb-3.5">
              {aiExplanation ? (
                <div className="space-y-1">
                  <p className="text-[9px] font-mono text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    AI Late Reasoning
                  </p>
                  <p className="text-xs text-slate-300 leading-normal">{aiExplanation}</p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] text-slate-400">
                    Need explanation for delays or status?
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
                    Explain
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[9px] font-mono uppercase tracking-wider text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-600" />
                Live Telemetry
              </div>
              <div className="text-emerald-400 font-bold">
                {fleet.length > 0 ? "STREAMING_ACTIVE" : "OFFLINE"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render invite code link form if not linked
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden font-sans">
      <div 
        className="absolute inset-0 opacity-[0.05] pointer-events-none" 
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[400px] relative z-10">
        <div className="glass-panel rounded-3xl p-8 shadow-2xl border border-white/[0.08]">
          <div className="flex flex-col items-center text-center">
            
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-6">
              <Link2 className="w-6 h-6" />
            </div>

            <h2 className="text-2xl font-bold font-mono text-white tracking-tight mb-2">Link Student</h2>
            <p className="text-slate-400 text-xs max-w-[280px] leading-relaxed mb-6">
              Enter the 6-digit secure invite code generated by your student&apos;s college admin console.
            </p>

            <form onSubmit={handleLink} className="w-full space-y-5">
              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. B8A9Z1"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold bg-slate-950 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent text-white transition-all"
                />
              </div>

              {linkError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-left text-xs font-mono text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p>{linkError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={inviteCode.length < 6 || linkLoading}
                className="w-full py-4 rounded-2xl font-mono text-xs font-bold tracking-wider uppercase text-white bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-900 disabled:text-slate-500 disabled:opacity-50 transition-all shadow-lg active:scale-[0.99]"
              >
                {linkLoading ? "VERIFYING_CODE..." : "LINK_STUDENT_PROFILE"}
              </button>
            </form>
            
            <div className="w-full mt-6 pt-5 border-t border-white/[0.06] flex items-center justify-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Secure parent verification
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
