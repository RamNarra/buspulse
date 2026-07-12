import { TopNav } from './top-nav';

interface AppShellProps {
  children: React.ReactNode;
}

/** Authenticated page shell — fixed top nav + scrollable content area */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#0a0a0b' }}>
      <TopNav />
      <main style={{ paddingTop: '56px' }}>{children}</main>
    </div>
  );
}
