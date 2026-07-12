'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, CaretDown, SignOut, User } from '@phosphor-icons/react';
import { useAuthContext } from '@/components/auth/auth-provider';
import { signOutCurrentUser } from '@/lib/firebase/auth';

// ── Types ──────────────────────────────────────────────────────────────────

type Role = 'student' | 'parent' | 'admin';

interface NavLink {
  label: string;
  href: string;
}

// ── Role-based nav link definitions ───────────────────────────────────────

const NAV_LINKS: Record<Role, NavLink[]> = {
  student: [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Track', href: '/dashboard' },
  ],
  parent: [
    { label: 'Dashboard', href: '/parent' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Fleet', href: '/admin/fleet' },
    { label: 'Users', href: '/admin/users' },
  ],
};

const DEFAULT_LINKS: NavLink[] = [{ label: 'Dashboard', href: '/dashboard' }];

// ── Role badge styling ─────────────────────────────────────────────────────

const ROLE_STYLES: Record<Role, { bg: string; color: string; label: string }> = {
  student: { bg: 'rgba(0,196,255,0.1)', color: '#00c4ff', label: 'Student' },
  parent:  { bg: 'rgba(34,197,94,0.1)',  color: '#22c55e', label: 'Parent' },
  admin:   { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa', label: 'Admin' },
};

// ── Dropdown animation ─────────────────────────────────────────────────────

const dropdownVariants = {
  hidden:  { opacity: 0, scale: 0.95, y: -4 },
  visible: { opacity: 1, scale: 1,    y: 0  },
};

// ── Component ──────────────────────────────────────────────────────────────

export function TopNav() {
  const { user } = useAuthContext();
  const router   = useRouter();
  const pathname = usePathname();

  const [role, setRole]           = useState<Role>('student');
  const [isOpen, setIsOpen]       = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolve custom claims role from ID token
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    user
      .getIdTokenResult()
      .then((result) => {
        if (cancelled) return;
        const claimsRole = result.claims?.role as Role | undefined;
        if (claimsRole && claimsRole in ROLE_STYLES) {
          setRole(claimsRole);
        }
      })
      .catch((err) => {
        console.error('[TopNav] Failed to fetch token claims:', err);
      });

    return () => { cancelled = true; };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await signOutCurrentUser();
      router.push('/login');
    } catch (err) {
      console.error('[TopNav] Sign out error:', err);
      setIsSigningOut(false);
    }
  }, [router]);

  // Gracefully handle unauthenticated state
  if (!user) return null;

  const navLinks  = NAV_LINKS[role] ?? DEFAULT_LINKS;
  const roleStyle = ROLE_STYLES[role];

  const displayName = user.displayName ?? user.email ?? 'User';
  const avatarLetter = displayName[0]?.toUpperCase() ?? '?';
  const truncatedName =
    displayName.length > 16 ? displayName.slice(0, 16) + '…' : displayName;

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: '56px',
        backgroundColor: '#0f0f12',
        borderBottom: '1px solid #1e1e28',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '16px',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <Link
        href="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
          flexShrink: 0,
        }}
        aria-label="BusPulse home"
      >
        <Bus size={20} color="#00c4ff" weight="fill" />
        <span
          style={{
            color: '#fafafa',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          BusPulse
        </span>
      </Link>

      {/* ── Nav links (desktop) ────────────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          // Hidden on mobile via media query class approach — inline style covers desktop
        }}
        className="bp-nav-links"
      >
        {navLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={`${link.label}-${link.href}`}
              href={link.href}
              style={{
                position: 'relative',
                padding: '6px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: isActive ? '#00c4ff' : '#8b8b9e',
                transition: 'color 150ms ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.color = '#fafafa';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.color = '#8b8b9e';
                }
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {link.label}
              {isActive && (
                <motion.span
                  layoutId="nav-underline"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '12px',
                    right: '12px',
                    height: '2px',
                    backgroundColor: '#00c4ff',
                    borderRadius: '1px',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Spacer for mobile (nav links hidden) ─────────────────────────── */}
      <div style={{ flex: 1 }} className="bp-nav-spacer" />

      {/* ── User menu ─────────────────────────────────────────────────────── */}
      <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          id="user-menu-trigger"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls="user-menu-dropdown"
          onClick={() => setIsOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px 4px 4px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1a1a1f';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          {/* Avatar */}
          <span
            aria-hidden="true"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#1a1a1f',
              border: '1px solid #252532',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00c4ff',
              fontSize: '0.8125rem',
              fontWeight: 700,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {avatarLetter}
          </span>

          {/* Name */}
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#fafafa',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            className="bp-user-name"
          >
            {truncatedName}
          </span>

          {/* Caret */}
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.15 }}
            style={{ display: 'flex', color: '#8b8b9e', marginLeft: '-2px' }}
          >
            <CaretDown size={14} weight="bold" />
          </motion.span>
        </button>

        {/* ── Dropdown ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id="user-menu-dropdown"
              role="menu"
              aria-labelledby="user-menu-trigger"
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.12, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: '52px',
                right: 0,
                minWidth: '220px',
                backgroundColor: '#0f0f12',
                border: '1px solid #252532',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                padding: '8px',
                zIndex: 100,
              }}
            >
              {/* User info block */}
              <div
                style={{
                  padding: '8px 10px 10px',
                  borderBottom: '1px solid #1e1e28',
                  marginBottom: '6px',
                }}
              >
                {/* Email */}
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: '#4a4a5e',
                    marginBottom: '6px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.email}
                </p>

                {/* Role badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    backgroundColor: roleStyle.bg,
                    color: roleStyle.color,
                  }}
                >
                  <User size={10} weight="fill" />
                  {roleStyle.label}
                </span>
              </div>

              {/* Sign out */}
              <button
                role="menuitem"
                onClick={handleSignOut}
                disabled={isSigningOut}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: isSigningOut ? '#4a4a5e' : '#ef4444',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: isSigningOut ? 'not-allowed' : 'pointer',
                  transition: 'background-color 150ms ease, color 150ms ease',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isSigningOut) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'rgba(239,68,68,0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'transparent';
                }}
              >
                <SignOut size={16} weight="bold" />
                {isSigningOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Responsive: hide nav links on mobile ──────────────────────────── */}
      <style>{`
        @media (max-width: 640px) {
          .bp-nav-links { display: none !important; }
          .bp-nav-spacer { display: block; }
          .bp-user-name  { display: none !important; }
        }
        @media (min-width: 641px) {
          .bp-nav-spacer { display: none; }
        }
      `}</style>
    </header>
  );
}
