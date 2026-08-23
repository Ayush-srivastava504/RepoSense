// Module: app/components/Sidebar.tsx
// Defines component(s)/export(s): Sidebar, ThemeToggle
// Defines function(s): isLinkActive
//

'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from './Logo';
import { useAuth } from '@/lib/auth';

type NavLink = { href: string; label: string };
type NavGroup = { key: string; label: string; icon: JSX.Element; links: NavLink[]; defaultOpen?: boolean };

function isLinkActive(href: string, pathname: string | null): boolean {
  const path = href.split('?')[0];
  if (path === '/') return pathname === '/';
  return pathname === path || (pathname?.startsWith(`${path}/`) ?? false);
}

/* ─── Icons (inline, no dependency) ─────────────── */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
      {children}
    </svg>
  );
}
const IconHiring = () => (<Icon><path d="M3 7h18v13H3z"/><path d="M8 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/></Icon>);
const IconInterview = () => (<Icon><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></Icon>);
const IconTools = () => (<Icon><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/></Icon>);
const IconDashboard = () => (<Icon><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></Icon>);
const IconTracker = () => (<Icon><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Icon>);
const IconAbout = () => (<Icon><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></Icon>);
const IconSearch = () => (<Icon><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Icon>);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none transition-transform duration-150" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconCollapse = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none transition-transform duration-150" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="10" y1="4" x2="10" y2="20"/>
  </svg>
);
const IconClose = () => (<Icon><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>);

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
  return (
    <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="sidebar-link w-full !text-left">
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
      {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'hiring',
    label: 'Hiring',
    icon: <IconHiring />,
    defaultOpen: true,
    links: [
      { href: '/jobs', label: 'Jobs' },
      { href: '/internships', label: 'Internships' },
      { href: '/remote-jobs', label: 'Remote' },
      { href: '/government-jobs', label: 'Government' },
      { href: '/japan-jobs', label: 'Japan' },
      { href: '/europe-jobs', label: 'Europe' },
      { href: '/hackathons', label: 'Hackathons' },
      { href: '/companies', label: 'Companies' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    key: 'interview',
    label: 'Interview',
    icon: <IconInterview />,
    links: [{ href: '/leetcode', label: 'LeetCode' }],
  },
  {
    key: 'ai-tools',
    label: 'AI Tools',
    icon: <IconTools />,
    links: [
      { href: '/tools', label: 'All tools' },
      { href: '/cover-letter', label: 'Cover Letter Generator' },
      { href: '/resume/builder', label: 'Resume Builder' },
      { href: '/ats-checker', label: 'ATS Checker' },
      { href: '/linkedin', label: 'LinkedIn Optimizer' },
      { href: '/github', label: 'README Generator' },
    ],
  },
];

const STANDALONE_LINKS: (NavLink & { icon: JSX.Element })[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { href: '/tracker', label: 'My Applications', icon: <IconTracker /> },
  { href: '/about', label: 'About', icon: <IconAbout /> },
];

function SidebarGroupSection({ group, pathname, collapsed, onNavigate, }: {
  group: NavGroup;
  pathname: string | null;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const hasActiveChild = group.links.some((l) => isLinkActive(l.href, pathname));
  const [open, setOpen] = useState(Boolean(group.defaultOpen) || hasActiveChild);

  if (collapsed) {
    return (
      <div className="mb-1">
        <Link href={group.links[0]?.href ?? '#'} onClick={onNavigate} title={group.label} className={`sidebar-link justify-center ${hasActiveChild ? 'is-active' : ''}`}>
          {group.icon}
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="sidebar-group-btn">
        {group.icon}
        <span className="flex-1 text-left">{group.label}</span>
        <IconChevron open={open} />
      </button>

      <div style={{
        maxHeight: open ? `${group.links.length * 40 + 8}px` : '0px',
        overflow: 'hidden',
        transition: 'max-height 200ms ease',
      }}>
        <div className="mt-0.5 flex flex-col gap-0.5 pl-[1.6rem]">
          {group.links.map((link) => {
            const active = isLinkActive(link.href, pathname);
            return (
              <Link key={link.href} href={link.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`sidebar-link ${active ? 'is-active' : ''}`}>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ mobileOpen, onClose, }: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === '1') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/jobs?search=${encodeURIComponent(q)}` : '/jobs');
    onClose();
  };

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`} aria-label="Sidebar navigation">
      <div className="flex h-14 flex-none items-center justify-between gap-2 border-b px-3" style={{ borderColor: 'var(--line)' }}>
        <Link href="/dashboard" aria-label="Go to dashboard" onClick={onClose} className="min-w-0">
          <Logo iconOnly={collapsed} />
        </Link>

        <button onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="btn btn-ghost !hidden !p-1.5 lg:!inline-flex">
          <IconCollapse collapsed={collapsed} />
        </button>

        <button onClick={onClose} aria-label="Close menu" className="btn btn-ghost !p-1.5 lg:!hidden">
          <IconClose />
        </button>
      </div>

      <div className="sidebar-scroll">
        {!collapsed && (
          <form onSubmit={submitSearch} className="mb-3">
            <label className="relative block">
              <span className="sr-only">Search jobs</span>
              <input ref={searchRef} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs…" className="field !py-2 !text-sm" style={{ paddingLeft: '2rem' }}/>
              <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}>
                <IconSearch />
              </span>
            </label>
          </form>
        )}

        {STANDALONE_LINKS.map((link) => {
          const active = isLinkActive(link.href, pathname);
          return (
            <Link key={link.href} href={link.href} onClick={onClose} title={collapsed ? link.label : undefined} aria-current={active ? 'page' : undefined} className={`sidebar-link mb-0.5 ${collapsed ? 'justify-center' : ''} ${active ? 'is-active' : ''}`}>
              {link.icon}
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}

        <hr className="hr-line my-2"/>

        {NAV_GROUPS.map((group) => (
          <SidebarGroupSection key={group.key} group={group} pathname={pathname} collapsed={collapsed} onNavigate={onClose}/>
        ))}
      </div>

      <div className="flex-none border-t p-2" style={{ borderColor: 'var(--line)' }}>
        <ThemeToggle collapsed={collapsed}/>

        {user ? (
          <>
            {!collapsed && (
              <p className="truncate px-2.5 pt-1.5 text-xs" style={{ color: 'var(--muted)' }} title={user.email}>
                {user.is_guest ? 'Guest session' : user.email}
              </p>
            )}
            {!user.is_guest && (
              <button onClick={logout} className={`sidebar-link mt-0.5 w-full !text-left ${collapsed ? 'justify-center' : ''}`}>
                {!collapsed ? 'Sign out' : '⏻'}
              </button>
            )}
          </>
        ) : (
          <Link href="/login" onClick={onClose} className={`sidebar-link mt-0.5 w-full ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? '→' : 'Sign in'}
          </Link>
        )}
      </div>
    </aside>
  );
}
