'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Gear, MapPin, SignOut } from '@phosphor-icons/react';

import { AppShell } from '@/components/nav/app-shell';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/components/auth/auth-provider';
import { signOutCurrentUser } from '@/lib/firebase/auth';
import { useAppStore } from '@/lib/store/app-store';

type MapType = 'hybrid' | 'roadmap' | 'satellite' | 'terrain';

const MAP_TYPE_OPTIONS: { value: MapType; label: string; description: string }[] = [
  { value: 'roadmap', label: 'Roads', description: 'Standard street map' },
  { value: 'hybrid', label: 'Hybrid', description: 'Satellite + roads (default)' },
  { value: 'satellite', label: 'Satellite', description: 'Pure satellite imagery' },
  { value: 'terrain', label: 'Terrain', description: 'Topographic detail' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthContext();
  const { mapType, setMapType } = useAppStore();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [role, setRole] = useState<string>('student');
  // Derive email directly from user object (no setState needed)
  const email = user?.email ?? '';

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user.getIdTokenResult().then((r) => {
      if (!cancelled) setRole((r.claims?.role as string) ?? 'student');
    });
    return () => { cancelled = true; };
  }, [user]);

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOutCurrentUser();
    router.push('/login');
  }

  if (!user && !authLoading) return null;

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-1">
            <Gear size={20} color="#8b8b9e" />
            <h1 className="text-heading">Settings</h1>
          </div>
          <p className="text-sm text-[#8b8b9e]">Manage your preferences and account</p>
        </motion.div>

        <div className="flex flex-col gap-6">
          {/* Account section */}
          <section
            className="rounded-[8px] overflow-hidden"
            style={{ background: '#0f0f12', border: '1px solid #1e1e28' }}
          >
            <div className="px-5 py-4 border-b border-[#1e1e28]">
              <p className="text-label">Account</p>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-xs text-[#8b8b9e] mb-1">Email</p>
                <p className="text-sm text-[#fafafa] font-mono">{email}</p>
              </div>
              <div>
                <p className="text-xs text-[#8b8b9e] mb-1">Role</p>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs font-medium capitalize"
                  style={{
                    background: 'rgba(0,196,255,0.1)',
                    color: '#00c4ff',
                  }}
                >
                  {role}
                </span>
              </div>
            </div>
          </section>

          {/* Map section */}
          <section
            className="rounded-[8px] overflow-hidden"
            style={{ background: '#0f0f12', border: '1px solid #1e1e28' }}
          >
            <div className="px-5 py-4 border-b border-[#1e1e28]">
              <div className="flex items-center gap-2">
                <MapPin size={14} color="#8b8b9e" />
                <p className="text-label">Map Style</p>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 gap-2">
              {MAP_TYPE_OPTIONS.map((opt) => {
                const isActive = mapType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMapType(opt.value)}
                    className="p-3 rounded-[8px] text-left transition-all"
                    style={{
                      background: isActive ? 'rgba(0,196,255,0.08)' : '#0a0a0b',
                      border: isActive ? '1px solid rgba(0,196,255,0.25)' : '1px solid #252532',
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: isActive ? '#00c4ff' : '#fafafa' }}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-[#8b8b9e] mt-0.5">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Sign out */}
          <section
            className="rounded-[8px] overflow-hidden"
            style={{ background: '#0f0f12', border: '1px solid #1e1e28' }}
          >
            <div className="px-5 py-4 border-b border-[#1e1e28]">
              <p className="text-label">Danger Zone</p>
            </div>
            <div className="p-5">
              <Button
                variant="danger"
                leftIcon={<SignOut size={16} weight="bold" />}
                isLoading={isSigningOut}
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
