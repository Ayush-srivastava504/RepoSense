'use client';
// app/dashboard/page.tsx
// This is a minimal example — wrap YOUR existing dashboard content with AuthGuard.
// AuthGuard redirects to /login if there is no valid token in localStorage.

import AuthGuard from '../../components/AuthGuard';
import AppShell from '../../components/AppShell';
import { useAuth } from '@/lib/auth';

function DashboardContent() {
  const { user, logout } = useAuth();

  return (
    <AppShell user={user} onLogout={logout}>
      <div>
        <p className="eyebrow eyebrow-accent">// overview</p>
        <h1 className="display mt-2 text-3xl font-medium">Dashboard</h1>
        <p className="mt-4" style={{ color: 'var(--ink-soft)' }}>
          Welcome back, {user?.email}
        </p>
        {/* rest of your dashboard UI */}
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}