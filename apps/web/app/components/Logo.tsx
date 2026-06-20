export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className="inline-flex h-6 w-6 items-center justify-center rounded-[5px]"
        style={{ background: 'var(--ink)' }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--green)' }} />
      </span>
      <span className="display text-[1.05rem] font-semibold leading-none">InternFlow</span>
    </span>
  );
}