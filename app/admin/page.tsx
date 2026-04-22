"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Users, 
  Bus as BusIcon, 
  Map, 
  LogOut,
  MoreVertical,
  Activity
} from "lucide-react";

import { useAuthSession } from "@/hooks/use-auth-session";
import { mockBus } from "@/lib/mock/fixtures";

export default function AdminPage() {
  const router = useRouter();
  const { signOut } = useAuthSession();
  const [activeTab, setActiveTab] = useState("overview");

  // In a real app, this would check if user role === 'admin'
  // For the sake of the MVP, we assume any authenticated user hitting this route is authorized 
  // or we just render the premium view for demonstration.

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
              <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                All Systems Operational
              </span>
            </div>
          </header>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: "Active Buses", value: "12", sub: "of 14 total fleet", trend: "+2" },
              { label: "Students Tracking", value: "482", sub: "Currently active sessions", trend: "+14%" },
              { label: "Avg. Route Deviation", value: "1.2m", sub: "Optimal pathing", trend: "-0.4m" },
              { label: "System Health", value: "99.9%", sub: "Last 30 days uptime", trend: "" },
            ].map((kpi, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                  <Activity className="w-16 h-16" />
                </div>
                <p className="text-sm font-semibold text-slate-500">{kpi.label}</p>
                <div className="flex items-end gap-3 mt-2 mb-1">
                  <h3 className="text-3xl font-extrabold text-slate-900">{kpi.value}</h3>
                  {kpi.trend && (
                    <span className={`text-sm font-bold pb-1 ${kpi.trend.startsWith("+") ? "text-green-500" : "text-blue-500"}`}>
                      {kpi.trend}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-400">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Active Fleet Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-900">Active Fleet Status</h3>
              <button className="text-blue-600 text-sm font-bold hover:text-blue-700">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bus Code</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Route</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { code: mockBus.code, driver: "A. Sharma", route: "Secunderabad Inbound", status: "Healthy" },
                    { code: "TS08UB1235", driver: "K. Reddy", route: "Kukatpally Inbound", status: "Healthy" },
                    { code: "TS08UB1236", driver: "M. Kumar", route: "Uppal Inbound", status: "Degraded" },
                    { code: "TS08UB1237", driver: "S. Rao", route: "L.B. Nagar Inbound", status: "Offline" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{row.code}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">{row.driver}</td>
                      <td className="px-6 py-4 text-slate-500">{row.route}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          row.status === "Healthy" ? "bg-green-100 text-green-700" :
                          row.status === "Degraded" ? "bg-yellow-100 text-yellow-800" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
