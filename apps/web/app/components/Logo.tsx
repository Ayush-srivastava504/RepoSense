// Module: app/components/Logo.tsx
// Defines component(s)/export(s): Logo
//
//

export default function Logo({ className = '', iconOnly = false, }: {
    className?: string;
    iconOnly?: boolean;
}) {
    return (<span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-[5px]" style={{ background: 'var(--ink)' }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--green)' }}/>
      </span>
      {!iconOnly && (<span className="display text-[1.05rem] font-semibold leading-none whitespace-nowrap">InternFlow</span>)}
    </span>);
}
