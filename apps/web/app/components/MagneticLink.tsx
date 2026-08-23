// Module: app/components/MagneticLink.tsx
// Defines component(s)/export(s): MagneticLink
// Defines type(s): MagneticLinkProps
//

'use client';
import Link from 'next/link';
import { useRef } from 'react';
type MagneticLinkProps = {
    href: string;
    className?: string;
    children: React.ReactNode;
    strength?: number;
    ariaLabel?: string;
};
export default function MagneticLink({ href, className = '', children, strength = 0.35, ariaLabel, }: MagneticLinkProps) {
    const ref = useRef<HTMLAnchorElement | null>(null);
    const prefersReducedMotion = () => typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const el = ref.current;
        if (!el || prefersReducedMotion())
            return;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const relX = x - rect.width / 2;
        const relY = y - rect.height / 2;
        el.style.transform = `translate(${relX * strength}px, ${relY * strength}px)`;
        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y}px`);
    };
    const handleLeave = () => {
        const el = ref.current;
        if (!el)
            return;
        el.style.transform = 'translate(0, 0)';
    };
    return (<Link href={href} ref={ref} aria-label={ariaLabel} onMouseMove={handleMove} onMouseLeave={handleLeave} className={`btn-magnetic glow-hover ${className}`.trim()}>
      {children}
    </Link>);
}
