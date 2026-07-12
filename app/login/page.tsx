'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, SpinnerGap } from '@phosphor-icons/react';
import { signInWithGoogle, checkRedirectResult } from '@/lib/firebase/auth';
import { useAuthContext } from '@/components/auth/auth-provider';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.2a10.34 10.34 0 0 0-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthContext();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  // Handle post-redirect result
  useEffect(() => {
    let cancelled = false;
    checkRedirectResult().then((result) => {
      if (cancelled) return;
      if (result?.ok === false) setError(result.error);
      if (result?.ok === true) router.push('/dashboard');
      setCheckingRedirect(false);
    });
    return () => { cancelled = true; };
  }, [router]);

  // If already authenticated, redirect
  useEffect(() => {
    if (!isLoading && !checkingRedirect && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, checkingRedirect, router]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result.ok === false) {
      setError(result.error);
      setSigningIn(false);
    }
    // If ok === true, stays loading — redirect will happen via auth state
  }

  const isButtonDisabled = signingIn || checkingRedirect || isLoading;

  return (
    <div className="min-h-dvh bg-[#0a0a0b] bg-dot-grid flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          className="w-[800px] h-[500px] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse, rgba(0,196,255,0.05) 0%, transparent 65%)',
          }}
        />
      </div>

      {/* Auth card content */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[360px] flex flex-col items-center"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="w-14 h-14 rounded-[12px] bg-[#00c4ff]/10 border border-[#00c4ff]/20 flex items-center justify-center">
            <Bus size={28} weight="bold" color="#00c4ff" />
          </div>
          <div className="text-center">
            <h1
              className="text-[#fafafa] font-bold"
              style={{ fontSize: '1.625rem', letterSpacing: '-0.04em', lineHeight: 1.1 }}
            >
              BusPulse
            </h1>
            <p className="text-[#8b8b9e] text-sm mt-1.5">Sign in to continue</p>
          </div>
        </div>

        {/* Sign-in button */}
        <div className="w-full flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: isButtonDisabled ? 1 : 0.98 }}
            transition={{ duration: 0.1 }}
            onClick={handleGoogleSignIn}
            disabled={isButtonDisabled}
            className="w-full h-12 rounded-[8px] flex items-center justify-center gap-3 text-sm font-medium text-[#fafafa] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#00c4ff]"
            style={{
              background: '#1a1a1f',
              border: '1px solid #252532',
            }}
            onMouseEnter={(e) => {
              if (!isButtonDisabled) {
                e.currentTarget.style.background = '#232328';
                e.currentTarget.style.borderColor = '#2e2e3e';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1a1a1f';
              e.currentTarget.style.borderColor = '#252532';
            }}
            aria-label="Continue with Google"
          >
            {isButtonDisabled ? (
              <SpinnerGap size={18} className="animate-spin text-[#8b8b9e]" />
            ) : (
              <GoogleIcon />
            )}
            <span>Continue with Google</span>
          </motion.button>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-[#ef4444] text-center px-2"
                role="alert"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Domain hint */}
        <p className="mt-5 text-xs text-[#4a4a5e] text-center leading-relaxed">
          Only{' '}
          <span className="font-mono text-[#6b6b7e]">@sreenidhi.edu.in</span>{' '}
          accounts are permitted
        </p>

        {/* Footer */}
        <p className="mt-16 text-[10px] text-[#4a4a5e]/60 text-center">
          BusPulse · Sreenidhi Institute of Science & Technology
        </p>
      </motion.div>
    </div>
  );
}
