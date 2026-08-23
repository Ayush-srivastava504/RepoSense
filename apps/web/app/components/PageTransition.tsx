// Module: app/components/PageTransition.tsx
// Defines component(s)/export(s): PageTransition
//
//

'use client';
import { usePathname } from 'next/navigation';
export default function PageTransition({ children }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    return (<div key={pathname} className="page-transition">
      {children}
    </div>);
}
