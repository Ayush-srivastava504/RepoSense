'use client';

import { useEffect, useRef } from 'react';

type ScrollRevealProps = {
  children: React.ReactNode;
  /** Reveal direct children one-by-one instead of the wrapper as a whole */
  stagger?: boolean;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  /** 0-1, how much of the element must be visible before revealing */
  threshold?: number;
};

/**
 * Fades + slides + un-blurs its content in as it scrolls into the viewport.
 * Pass `stagger` to animate direct children one after another (cards, grids).
 * Once revealed, the element stays revealed (no re-hiding on scroll-out).
 */
export default function ScrollReveal({
  children,
  stagger = false,
  className = '',
  as = 'div',
  threshold = 0.15,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If the browser can't do IntersectionObserver, just show the content.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const Tag = as as any;
  const baseClass = stagger ? 'scroll-reveal-group' : 'scroll-reveal';

  return (
    <Tag ref={ref} className={`${baseClass} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
