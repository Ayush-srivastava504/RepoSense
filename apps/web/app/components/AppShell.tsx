'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

const sections = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/github', label: 'Code review' },
  { href: '/jobs', label: 'Internships' },
  { href: '/resume/builder', label: 'Resume' },
];

export default function AppShell({
  children,
  user,
  onLogout,
}: {
  children: React.ReactNode;
  user?: { email: string } | null;
  onLogout?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <header className="sticky top-0 z-40 border-b" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
        <div className="container-xl flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {sections.map((s) => {
                const active = pathname?.startsWith(s.href);
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="nav-link relative pb-1"
                    style={active ? { color: 'var(--ink)', fontWeight: 600 } : undefined}
                  >
                    {s.label}
                    {active && (
                      <span
                        className="absolute -bottom-[1px] left-0 h-[2px] w-full rounded-full"
                        style={{ background: 'var(--indigo)' }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {user ? (
            <div className="flex items-center gap-4">
              <span className="eyebrow hidden sm:inline">{user.email}</span>
              <button onClick={onLogout} className="btn btn-ghost !px-2 !py-1 text-sm">
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-secondary text-sm">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="container-xl py-10">{children}</main>
    </div>
  );
}