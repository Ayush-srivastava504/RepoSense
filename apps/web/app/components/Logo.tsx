// Module: app/components/Logo.tsx
// Defines component(s)/export(s): Logo
//
//

export default function Logo({ className = '', iconOnly = false, }: {
    className?: string;
    iconOnly?: boolean;
}) {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="InternFlow">
        <svg
          aria-hidden="true"
          className="h-8 w-8 flex-none"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="9" fill="#17191F"/>
          <path
            d="M8 23V12.5C8 10.567 9.567 9 11.5 9H24"
            stroke="#67D9A5"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19.5 4.5L24 9L19.5 13.5"
            stroke="#67D9A5"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="23" r="3" fill="#67D9A5"/>
        </svg>
        {!iconOnly && (
          <span
            className="text-[1.08rem] font-bold leading-none whitespace-nowrap"
            style={{ color: 'var(--ink)', letterSpacing: '-0.035em' }}
          >
            Intern<span style={{ color: 'var(--green)' }}>Flow</span>
          </span>
        )}
      </span>
    );
}
