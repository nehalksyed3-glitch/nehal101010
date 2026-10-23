export function Logo({ light = false, size = 36 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="16" fill={light ? "#fff" : "#0b2a5b"} />
        <path d="M32 12 14 50h9l3.5-8h11l3.5 8h9L32 12Zm0 18 3.6 8.4h-7.2L32 30Z" fill={light ? "#0b2a5b" : "#fff"} />
        <circle cx="50" cy="14" r="5" fill="#f28c28" />
        <circle cx="14" cy="14" r="3" fill="#18a874" />
      </svg>
      <span className="font-display leading-none"><span className={light ? "text-white" : "text-navy-900"} style={{ fontWeight: 700, fontSize: size * 0.5 }}>Assorted</span><br /><span className={light ? "text-white/70" : "text-muted"} style={{ fontSize: size * 0.3, letterSpacing: "0.22em" }}>GROUP</span></span>
    </span>
  );
}
