/** Compact SVG icons for HUD inventory / location. */

type IconProps = { className?: string; title?: string };

export function IconPlane({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      {/* takeoff airliner + runway */}
      <g transform="translate(8 6.2) rotate(-28) translate(-8 -7)">
        <rect x="2" y="5.8" width="9" height="2.2" rx="1.1" fill="currentColor" />
        <ellipse cx="11.6" cy="6.9" rx="1.6" ry="1.15" fill="currentColor" />
        <path fill="currentColor" d="M5.2 7.2 8.6 6.9 7.8 11.2 4.4 11.4z" />
        <ellipse cx="5.8" cy="9.2" rx="0.9" ry="0.55" fill="currentColor" />
        <path fill="currentColor" d="M2.2 6 4 6 3.4 2.8 1.8 3.6zM2 7.6 4 7.6 2.2 9.4 1.2 9z" />
      </g>
      <rect x="3" y="12.6" width="10" height="1.3" rx="0.65" fill="currentColor" />
    </svg>
  );
}

export function IconShip({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      {/* yacht on waves */}
      <path fill="currentColor" d="M1.5 9.2h9.2l2.3-1.4H2.2z" />
      <rect x="3.2" y="6.2" width="7" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="4.2" y="9.4" width="1.4" height="0.7" rx="0.3" fill="#fff" />
      <rect x="6.2" y="9.4" width="1.4" height="0.7" rx="0.3" fill="#fff" />
      <rect x="8.2" y="9.4" width="1.4" height="0.7" rx="0.3" fill="#fff" />
      <line x1="6.2" y1="6.2" x2="6.2" y2="3.4" stroke="currentColor" strokeWidth="1.3" />
      <line x1="8.2" y1="6.2" x2="8.2" y2="4.4" stroke="currentColor" strokeWidth="1.3" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        d="M1.2 12.2q1.2-.8 2.4 0t2.4 0 2.4 0 2.4 0 2.4 0"
      />
    </svg>
  );
}

export function IconHouse({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M8 2.2 2.5 7H4v6.5h3.2V9.4h1.6v4.1H12V7h1.5L8 2.2z"
      />
    </svg>
  );
}

/** Industry special — factory silhouette (sawtooth roof + chimney). */
export function IconFactory({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      {/* Ground */}
      <rect x="0.85" y="13.45" width="14.3" height="1.4" fill="currentColor" />
      {/* Rear roof block (2 small peaks) */}
      <path
        fill="currentColor"
        d="M2.45 5.35V3.45L3.4 2.55V3.4L4.4 2.55V5.35z"
      />
      {/* Front hall: 3 rising sawteeth + door cutouts */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M1.15 13.45V7.5L2.9 5.5V7.1L4.7 5.15V6.75L6.7 4.45V13.45H1.15ZM2.2 7.85h1.1v4.15H2.2Zm1.75 0h1.1v4.15H3.95Zm1.75 0h1.1v4.15H5.7Z"
      />
      {/* Chimney (taper), flush with hall */}
      <path fill="currentColor" d="M6.7 13.45V1.75h1.4l2.05 1.25V13.45H6.7z" />
      {/* Side pipe / arch */}
      <path
        fill="currentColor"
        d="M10.7 9.7c1.4.25 2.25 1.4 1.8 2.65-.3.85-1.15 1.3-2.1 1.3H9.15v-1.2h.95c.42 0 .72-.32.8-.6.12-.5-.2-.92-.72-1.02l-.48-.1V9.7z"
      />
    </svg>
  );
}

/** Commerce special — coin. */
export function IconCoin({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <circle
        cx="8"
        cy="8"
        r="6.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        fill="currentColor"
        d="M8.7 4.2H7.2v1.1H6.1v1.3h1.1v3.2H6.1V11h1.1v1.1h1.5V11h1.2v-1.2H8.7V6.6h1.2V5.3H8.7V4.2z"
      />
    </svg>
  );
}

/** Tourism special — suitcase. */
export function IconSuitcase({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M5.2 3.2h5.6v1.6H5.2V3.2zM2.2 5.2h11.6v8.2H2.2V5.2zm4.2 1.6v5h1.3v-5H6.4zm2.9 0v5H10.6v-5H9.3z"
      />
    </svg>
  );
}

export function IconDischarge({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect x="1.5" y="2" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path fill="currentColor" d="M7.2 4.2h1.6v2.8h2.8v1.6H8.8v2.8H7.2V8.6H4.4V7h2.8z" />
    </svg>
  );
}

/** Casino VIP holdable card. */
export function IconVipCard({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect
        x="1.5"
        y="3.2"
        width="13"
        height="9.6"
        rx="1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        fill="currentColor"
        d="M3.2 5.2h4.2v1.2H3.2V5.2zm0 2.4h9.6v1H3.2v-1zm0 2.2h6.2v1H3.2v-1z"
      />
      <circle cx="11.6" cy="5.8" r="1.3" fill="currentColor" />
    </svg>
  );
}

/** Monte Carlo entrance — playing cards. */
export function IconPoker({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect
        x="5.2"
        y="2.2"
        width="7.2"
        height="10"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        transform="rotate(12 8.8 7.2)"
      />
      <rect
        x="2.4"
        y="3"
        width="7.2"
        height="10"
        rx="1"
        fill="currentColor"
      />
      <path
        fill="#fff"
        d="M6 5.2c.7-.9 2-.9 2.6 0 .4.6.2 1.3-.3 1.8L6 9.2 4.7 7c-.5-.5-.7-1.2-.3-1.8.6-.9 1.9-.9 2.6 0z"
        opacity="0.95"
      />
    </svg>
  );
}

/** Las Vegas entrance — chips. */
export function IconChips({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <ellipse
        cx="8"
        cy="10.2"
        rx="5.2"
        ry="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <ellipse cx="8" cy="7.2" rx="5.2" ry="2.2" fill="currentColor" />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="1.1"
        d="M3.4 7.2c1.2 1 2.8 1.6 4.6 1.6s3.4-.6 4.6-1.6"
        opacity="0.85"
      />
    </svg>
  );
}

/** Racetrack slot cell — triple 7. */
export function IconSlot777({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect
        x="1.4"
        y="3"
        width="13.2"
        height="10"
        rx="1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        fill="currentColor"
        d="M3.1 5.1h2.6l-1.5 6.2H2.6L3.1 5.1zm4.1 0h2.6l-1.5 6.2H6.7L7.2 5.1zm4.1 0h2.6l-1.5 6.2h-1.6L11.3 5.1z"
      />
    </svg>
  );
}

export function IconBank({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d="M8 1.8 1.8 5v1.2h12.4V5L8 1.8zM3 7.2h2v4.5H3V7.2zm4 0h2v4.5H7V7.2zm4 0h2v4.5h-2V7.2zM2 12.5h12V14H2v-1.5z" />
    </svg>
  );
}

export function IconAirport({ className, title }: IconProps) {
  return <IconPlane className={className} title={title} />;
}

export function IconHospital({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        fill="#d32f2f"
        d="M6.2 2.2h3.6v3.8h3.8v3.6H9.8v3.8H6.2V9.6H2.4V6h3.8V2.2z"
      />
    </svg>
  );
}

export function IconCasino({ className, title }: IconProps) {
  return <IconExchange className={className} title={title} />;
}

/** Stock exchange — trend chart with support/resistance. */
export function IconExchange({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        d="M1.5 6.2h13M1.5 10.2h13"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M1.8 11.2 4.2 6.4 6.2 9.6 8.4 5.6 10.4 9.2 12.4 4.8 14.2 3.6"
      />
      <circle cx="4.2" cy="6.4" r="0.7" fill="currentColor" />
      <circle cx="6.2" cy="9.6" r="0.7" fill="currentColor" />
      <circle cx="8.4" cy="5.6" r="0.7" fill="currentColor" />
      <circle cx="10.4" cy="9.2" r="0.7" fill="currentColor" />
      <circle cx="12.4" cy="4.8" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function IconEvent({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path fill="currentColor" d="M7.1 4.2h1.8c1.3 0 2.2.8 2.2 1.9 0 .9-.5 1.5-1.3 1.9l-.7.4v1.1H7.6V8.6l1.1-.6c.5-.3.7-.6.7-1.1 0-.4-.3-.7-.9-.7H7.1V4.2zm.5 6.6h1.8v1.7H7.6v-1.7z" />
    </svg>
  );
}

export function IconPort({ className, title }: IconProps) {
  return <IconShip className={className} title={title} />;
}

export function IconOil({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      {/* pumpjack silhouette */}
      <path
        fill="currentColor"
        d="M1.5 13.2h13v1.2h-13zM7.2 4.2 8.8 4.2 10.6 12.2 9.2 12.2 8.2 6.6 7.2 12.2 5.8 12.2zM3.2 5.2 12.2 7.4 12.5 6.2 3.5 4z"
      />
      <path
        fill="currentColor"
        d="M11.6 7.2c1.2.2 2 1.4 1.4 2.5-.4.7-1.3.9-2 .6l-.4 1.4h-1l.5-2c-.3-.6-.1-1.4.5-1.8.3-.2.6-.3 1-.3z"
      />
      <circle cx="4.2" cy="10.2" r="1.8" fill="currentColor" />
      <circle cx="4.2" cy="10.2" r="0.7" fill="#fff" />
      <path fill="currentColor" d="M2 11.2h1.6v1.2H2zM4.2 8.6 7.4 5.4l.7.7-3.2 3.2z" />
    </svg>
  );
}

export function IconMine({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M1 13.6 3.8 8.2l1.8 1.8L8 6.2l2 2.6 1.6-1.4L15 13.6H1z"
        opacity="0.35"
      />
      <path
        fill="currentColor"
        d="M9.4 5.2 10.8 3.4 12.2 5.2H9.4zm.3 0h2.1v6.4H9.7zM8.8 7.4 4.2 9.2l.6 1.3 4.6-1.6z"
      />
      <circle cx="4" cy="10.4" r="2.6" fill="currentColor" />
      <circle cx="4" cy="10.4" r="1.3" fill="#fff" />
      <circle cx="4" cy="10.4" r="0.45" fill="currentColor" />
      <path fill="currentColor" d="M7.6 12.2h4.8v1.3H7.6z" />
    </svg>
  );
}

export function IconProperty({ className, title }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d="M3 13V6.2L8 2.8l5 3.4V13H9.5V9.2H6.5V13H3z" />
    </svg>
  );
}

export function IconCasinoEntranceTile({ className, title }: IconProps) {
  return <IconPoker className={className} title={title} />;
}

export function IconDiceFace({
  value,
  className,
  title,
}: {
  value: number;
  className?: string;
  title?: string;
}) {
  const n = Math.max(1, Math.min(6, Math.round(value)));
  const dots: Record<number, [number, number][]> = {
    1: [[8, 8]],
    2: [
      [4.5, 4.5],
      [11.5, 11.5],
    ],
    3: [
      [4.5, 4.5],
      [8, 8],
      [11.5, 11.5],
    ],
    4: [
      [4.5, 4.5],
      [11.5, 4.5],
      [4.5, 11.5],
      [11.5, 11.5],
    ],
    5: [
      [4.5, 4.5],
      [11.5, 4.5],
      [8, 8],
      [4.5, 11.5],
      [11.5, 11.5],
    ],
    6: [
      [4.5, 4.2],
      [11.5, 4.2],
      [4.5, 8],
      [11.5, 8],
      [4.5, 11.8],
      [11.5, 11.8],
    ],
  };
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden={!title}>
      {title ? <title>{title}</title> : null}
      <rect
        x="1.2"
        y="1.2"
        width="13.6"
        height="13.6"
        rx="2.2"
        fill="#f7f4ee"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      {dots[n]!.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.35" fill="currentColor" />
      ))}
    </svg>
  );
}
