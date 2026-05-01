"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Users,
  Bus as BusIcon,
  Map,
  LogOut,
  Activity,
  AlertTriangle,
  Ticket,
  Copy,
  Check,
} from "lucide-react";
import { getAuth } from "firebase/auth";

import { useAuthSession } from "@/hooks/use-auth-session";
import { useFleetWithHealth, type FleetBusWithHealth } from "@/hooks/use-fleet-with-health";
import { generateParentInvite } from "@/app/actions/parent";
import type { BusHealthStatus } from "@/types/models";

// --- helpers ---

function statusColor(status: BusHealthStatus) {
  switch (status) {
    case "healthy":  return "bg-green-100 text-green-700";
    case "degraded": return "bg-yellow-100 text-yellow-800";
    case "stale":    return "bg-orange-100 text-orange-800";
    case "deviated": return "bg-purple-100 text-purple-800";
    case "stranded": return "bg-red-100 text-red-800";
    case "ghost":    return "bg-slate-100 text-slate-600";
    case "offline":  return "bg-slate-200 text-slate-500";
    default:         return "bg-slate-100 text-slate-600";
  }
}

function statusDot(status: BusHealthStatus) {
  switch (status) {
    case "healthy":  return "bg-green-500";
    case "degraded": return "bg-yellow-500";
    case "stale":    return "bg-orange-500";
    case "deviated": return "bg-purple-500";
    case "stranded": return "bg-red-500";
    case "ghost":    return "bg-slate-400";
    case "offline":  return "bg-slate-400";
    default:         return "bg-slate-400";
  }
}

function fmtDuration(ms: number) {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// --- InvitePanel ---

function InvitePanel() {
  const [studentId, setStudentId] = useState("");
  const [rel, setRel] = useState<"mother" | "father" | "guardian" | "other">("guardian");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string; expiresAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) { setError("Not authenticated."); setLoading(false); return; }
      const idToken = await user.getIdToken();
      const res = await generateParentInvite(studentId.trim(), rel, idToken);
      if (!res.ok) setError(res.error);
      else setResult({ code: res.code, expiresAt: res.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (result) {
      void navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
        <Ticket className="w-4 h-4 text-blue-500" /> Generate Parent Invite
      </h3>
      <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          required
          placeholder="Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={rel}
          onChange={(e) => setRel(e.target.value as typeof rel)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="mother">Mother</option>
          <option value="father">Father</option>
          <option value="guardian">Guardian</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          disabled={loading || !studentId}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      {result && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <span className="font-mono text-2xl font-bold tracking-[0.4em] text-slate-900">{result.code}</span>
          <button onClick={copy} className="ml-auto text-slate-400 hover:text-slate-700 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            Expires {new Date(result.expiresAt).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

// --- AlertsPanel ---

function AlertsPanel({ alerts }: { alerts: FleetBusWithHealth[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-2">
      <h3 className="text-sm font-bold text-red-800 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> SLA Alerts ({alerts.length})
      </h3>
      <ul className="space-y-1">
        {alerts.map((b) => (
          <li key={b.routeNumber} className="flex items-center gap-3 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${statusColor(b.status)}`}>
              {b.status}
            </span>
            <span className="font-semibold text-slate-900">Bus {b.routeNumber}</span>
            <span className="text-slate-500">
              &mdash;{" "}
              {b.status === "stranded"
                ? `stranded for ${fmtDuration(b.alertDurationMs)}`
                : b.status === "deviated"
                ? `off-route for ${fmtDuration(b.alertDurationMs)}`
                : b.status === "ghost"
                ? "no GPS signal"
                : b.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Page ---

export default function AdminPage() {
  const router = useRouter();
  const { signOut } = useAuthSession();
  const [activeTab, setActiveTab] = useState("overview");

  const { fleet, alerts } = useFleetWithHealth();
  const activeBuses = fleet.length;
  const totalPingers = fleet.reduce((acc, b) => acc + b.activePingers, 0);
  const healthyBuses = fleet.filter((b) => b.status === "healthy").length;
  const systemHealth =
    activeBuses === 0 ? "N/A" : `${Math.round((healthyBuses / activeBuses) * 100)}%`;

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 flex items-center gap-3 text-white border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Admin Console</h1>
            <p className="text-xs text-slate-400">BusPulse Enterprise</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "fleet", label: "Fleet & Routes", icon: BusIcon },
            { id: "users", label: "Students & Parents", icon: Users },
            { id: "map", label: "Live Command", icon: Map },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === item.id
                  ? "bg-blue-600/10 text-blue-400"
                  : "hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.id === "overview" && alerts.length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => {
              void signOut();
              router.push("/login");
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">System Overview</h2>
              <p className="text-sm text-slate-500 font-medium">Real-time metrics across all active fleets.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5 ${
                alerts.length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${alerts.length > 0 ? "bg-red-500" : "bg-green-500"}`} />
                {alerts.length > 0 ? `${alerts.length} Alert${alerts.length > 1 ? "s" : ""}` : "All Systems Operational"}
              </span>
            </div>
          </header>

          <AlertsPanel alerts={alerts} />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: "Active Buses", value: String(activeBuses), sub: "with live contributors" },
              { label: "Students Tracking", value: String(totalPingers), sub: "Active GPS contributors" },
              { label: "Anomaly Alerts", value: String(alerts.length), sub: alerts.length > 0 ? "Buses need attention" : "Fleet running normally", warn: alerts.length > 0 },
              { label: "System Health", value: systemHealth, sub: `${healthyBuses} of ${activeBuses} live` },
            ].map((kpi, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                  <Activity className="w-16 h-16" />
                </div>
                <p className="text-sm font-semibold text-slate-500">{kpi.label}</p>
                <div className="flex items-end gap-3 mt-2 mb-1">
                  <h3 className={`text-3xl font-extrabold ${"warn" in kpi && kpi.warn ? "text-red-600" : "text-slate-900"}`}>
                    {kpi.value}
                  </h3>
                </div>
                <p className="text-xs font-medium text-slate-400">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Active Fleet Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-900">Active Fleet Status</h3>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{fleet.length} buses tracked</span>
            </div>
            {fleet.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <BusIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400">No buses are actively tracked right now.</p>
                <p className="text-xs text-slate-400 mt-1">Fleet signals appear here as students board and contribute GPS.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-white border-b border-slate-100">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bus ID</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contributors</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Health</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Signal</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fleet.map((bus) => {
                      // eslint-disable-next-line react-hooks/purity
                      const ageS = Math.round((Date.now() - bus.updatedAt) / 1000);
                      return (
                        <tr key={bus.routeNumber} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-900">{bus.routeNumber}</td>
                          <td className="px-6 py-4 font-medium text-slate-600">{bus.activePingers}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor(bus.status)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDot(bus.status)}`} />
                              {bus.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              bus.estimated ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-700"
                            }`}>
                              {bus.estimated ? "Estimated" : "Live"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{ageS}s ago</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Parent invite generator — always visible to admins */}
          <InvitePanel />

        </div>
      </main>
    </div>
  );
}
