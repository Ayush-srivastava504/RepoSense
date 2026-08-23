// Module: app/components/ScrollReveal.tsx
// Defines component(s)/export(s): ScrollReveal
// Defines type(s): ScrollRevealProps
//

'use client';
import { useEffect, useRef } from 'react';
type ScrollRevealProps = {
    children: React.ReactNode;
    stagger?: boolean;
    className?: string;
    as?: keyof JSX.IntrinsicElements;
    threshold?: number;
};
export default function ScrollReveal({ children, stagger = false, className = '', as = 'div', threshold = 0.15, }: ScrollRevealProps) {
    const ref = useRef<HTMLElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        if (typeof IntersectionObserver === 'undefined') {
            el.classList.add('is-visible');
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold, rootMargin: '0px 0px -8% 0px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);
    const Tag = as as any;
    const baseClass = stagger ? 'scroll-reveal-group' : 'scroll-reveal';
    return (<Tag ref={ref} className={`${baseClass} ${className}`.trim()}>
      {children}
    </Tag>);
}
