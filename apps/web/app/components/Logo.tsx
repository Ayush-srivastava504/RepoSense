// Module: app/components/Logo.tsx
// Defines component(s)/export(s): Logo
//
// InternFlow mark: a lowercase "i" whose stem turns forward into a path (intern -> the next step), on the
// brand's deep-green tile, with a gold dot as the single accent. Same drawing as public/icon.svg and the
// favicons, so keep them in sync. The wordmark is one colour (ink) for a calm, professional lockup.

export default function Logo({ className = '', iconOnly = false, }: {
    className?: string;
    iconOnly?: boolean;
}) {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="InternFlow">
        <svg
          aria-hidden="true"
          className="h-8 w-8 flex-none"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="48" height="48" rx="12" fill="#1F5C40"/>
          <circle cx="16" cy="13.2" r="3.7" fill="#E9C46A"/>
          <path
            d="M16 21.4V26.6C16 31.5 19.6 35 24.6 35H33"
            stroke="#FFFFFF"
            strokeWidth="5.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {!iconOnly && (
          <span
            className="text-[1.08rem] font-semibold leading-none whitespace-nowrap"
            style={{ color: 'var(--ink)', letterSpacing: '-0.035em' }}
          >
            InternFlow
          </span>
        )}
      </span>
    );
}
