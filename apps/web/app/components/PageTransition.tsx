'use client';

import { usePathname } from 'next/navigation';

/**
 * Wraps route content and re-triggers a subtle fade-in whenever the
 * pathname changes, so navigating between pages feels like a soft
 * transition instead of an abrupt swap.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
