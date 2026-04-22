"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthSession } from "@/hooks/use-auth-session";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuthSession();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    router.replace(user ? "/dashboard" : "/login");
  }, [isLoading, router, user]);

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-[#eef2f7]" style={{
      background: "radial-gradient(circle at 12% 15%, rgba(18,90,212,.18), transparent 35%), radial-gradient(circle at 88% 14%, rgba(0,163,122,.16), transparent 35%), #eef2f7"
    }}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Opening BusPulse...</p>
      </div>
    </div>
  );
}
