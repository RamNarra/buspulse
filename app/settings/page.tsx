"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";

import { useAuthSession } from "@/hooks/use-auth-session";
import { useCurrentStudentProfile } from "@/hooks/use-current-student-profile";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { mockStudent } from "@/lib/mock/fixtures";

function StatusRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const badgeClasses = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-800",
  }[tone];

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClasses}`}>
        {value}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { mode, user, signOut } = useAuthSession();
  const profile = useCurrentStudentProfile(user);
  const setup = useSetupStatus();
  const effectiveStudent = profile.student ?? mockStudent;

  const setupTips: string[] = [];
  if (!setup.firebaseReady) {
    setupTips.push("Complete Firebase connection values to enable live sign-in and data sync.");
  }
  if (!setup.mapsReady) {
    setupTips.push("Add a browser key for Maps JavaScript API to enable live map tiles.");
  }
  if (!setup.projectIdMatchesExpected) {
    setupTips.push("Use the expected BusPulse Firebase project before production rollout.");
  }
  if (!setup.hasAllowedDomains) {
    setupTips.push("Add college domains to enforce student account access policies.");
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 py-8 px-4 sm:py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors bg-white hover:bg-slate-100 px-4 py-2 rounded-full shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Account</h2>
          <p className="text-sm text-slate-600">{user?.email ?? "Preview mode"}</p>
          <p className="text-sm text-slate-600 mt-1">Assigned bus: {effectiveStudent.busId}</p>
          {user ? (
            <button
              onClick={() => void signOut()}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-full text-sm font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          ) : null}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">App status</h2>
          <div className="flex flex-col">
            <StatusRow
              label="Data mode"
              value={mode === "live" ? "Live" : "Preview"}
              tone={mode === "live" ? "success" : "default"}
            />
            <StatusRow
              label="Map experience"
              value={setup.mapsReady ? "Ready" : "Fallback"}
              tone={setup.mapsReady ? "success" : "warning"}
            />
            <StatusRow
              label="Authentication"
              value={setup.firebaseReady ? "Configured" : "Needs setup"}
              tone={setup.firebaseReady ? "success" : "warning"}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Setup help</h2>
          {setupTips.length === 0 ? (
            <p className="text-sm text-slate-600">Everything required for live student tracking is configured.</p>
          ) : (
            <div className="space-y-2">
              {setupTips.map((tip) => (
                <div key={tip} className="flex gap-2 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <p className="text-sm text-slate-600">{tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
