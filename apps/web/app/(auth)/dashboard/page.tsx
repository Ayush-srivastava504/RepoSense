'use client';

import { useEffect } from 'react';
import AuthGuard from '../../components/AuthGuard';
import AppShell from '../../components/AppShell';
import { useAuth } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';

function DashboardContent() {
  const { user, logout } = useAuth();

  useEffect(() => {
    trackEvent('dashboard_viewed', {
      user_email: user?.email,
    });
  }, [user]);

  const handleLogout = () => {
    trackEvent('logout');
    logout();
  };

  return (
    <AppShell user={user} onLogout={handleLogout}>
      <div>
        <p className="eyebrow eyebrow-accent">// overview</p>

        <h1 className="display mt-2 text-3xl font-medium">
          Dashboard
        </h1>

        <p
          className="mt-4"
          style={{ color: 'var(--ink-soft)' }}
        >
          Welcome back, {user?.email}
        </p>

        {/* Dashboard Stats */}
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="card p-4">
            <h3>Total Analyses</h3>
            <p className="text-2xl font-bold">0</p>
          </div>

          <div className="card p-4">
            <h3>Resumes Generated</h3>
            <p className="text-2xl font-bold">0</p>
          </div>

          <div className="card p-4">
            <h3>Jobs Applied</h3>
            <p className="text-2xl font-bold">0</p>
          </div>

          <div className="card p-4">
            <h3>Repositories Connected</h3>
            <p className="text-2xl font-bold">0</p>
          </div>
        </div>
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