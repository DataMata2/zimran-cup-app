/** The small padlock next to a Pro feature's heading for free users. */
export function LockIcon({ className = "size-4 text-ink-3" }: { className?: string }) {
  return (
    <svg role="img" aria-label="Pro" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
    </svg>
  );
}
