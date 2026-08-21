/**
 * Panel ikonları — tek dosyada, bağımlılıksız inline SVG.
 *
 * Hepsi 20x20 viewBox'ta, `currentColor` ile çizilir; boyut/renk sarmalayan
 * elemandan gelir (bkz. PanelSidebar `navIcon`).
 */
export type IconProps = { className?: string };

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" />
    </svg>
  );
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7.5 3.5h5M7 3.5a1 1 0 011-1h4a1 1 0 011 1v1H7v-1z" />
      <path d="M13 4.5h2a1 1 0 011 1V16a1 1 0 01-1 1H5a1 1 0 01-1-1V5.5a1 1 0 011-1h2" />
      <path d="M7.5 11l1.8 1.8 3.5-3.6" />
    </svg>
  );
}

export function GloveIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8a4 4 0 014-4h3a4 4 0 014 4v3H4V8z" />
      <path d="M15 7.5h.8a1.7 1.7 0 010 3.4H15" />
      <path d="M4 11h11v2.5a1 1 0 01-1 1H5a1 1 0 01-1-1V11z" />
      <path d="M6 14.5v1.5a1 1 0 001 1h5a1 1 0 001-1v-1.5" />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 17h14" />
      <path d="M5.5 17V9.5" />
      <path d="M10 17V4.5" />
      <path d="M14.5 17v-5" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.5h8v4a4 4 0 01-8 0v-4z" />
      <path d="M6 5H4.2a.7.7 0 00-.7.8c.2 1.7 1.2 2.7 2.5 3" />
      <path d="M14 5h1.8a.7.7 0 01.7.8c-.2 1.7-1.2 2.7-2.5 3" />
      <path d="M10 11.5V14" />
      <path d="M7 16.5h6" />
      <path d="M8 14h4l.5 2.5h-5L8 14z" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="7" r="2.8" />
      <path d="M2.8 16.5c.4-2.6 2.6-4.2 5.2-4.2s4.8 1.6 5.2 4.2" />
      <path d="M13.5 4.6a2.8 2.8 0 010 5.3" />
      <path d="M15 12.6c1.4.5 2.3 1.8 2.5 3.4" />
    </svg>
  );
}

export function InboxIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 11.5L5 4h10l2 7.5" />
      <path d="M3 11.5h4l1 2h4l1-2h4v4a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 15.5v-4z" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 17H4.5A1.5 1.5 0 013 15.5v-11A1.5 1.5 0 014.5 3H8" />
      <path d="M13.5 13.5L17 10l-3.5-3.5" />
      <path d="M17 10H7.5" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function ExternalIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11 3.5h5.5V9" />
      <path d="M16.5 3.5L9 11" />
      <path d="M15 12v3.5A1.5 1.5 0 0113.5 17h-9A1.5 1.5 0 013 15.5v-9A1.5 1.5 0 014.5 5H8" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="1.5" />
      <path d="M3 8.5h14" />
      <path d="M7 3v3M13 3v3" />
      <path d="M6.5 11.5h2M11.5 11.5h2M6.5 14h2" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6v4.25l2.75 1.75" />
    </svg>
  );
}

export function MessageIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M17 12a2 2 0 01-2 2H7l-4 3V5a2 2 0 012-2h10a2 2 0 012 2v7z" />
      <path d="M7 7.5h6M7 10.5h4" />
    </svg>
  );
}

export function PlanIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="2.5" width="13" height="15" rx="1.5" />
      <path d="M7 6.5h6M7 10h6M7 13.5h3.5" />
    </svg>
  );
}

/** Tartı — fight tarafının kilo/kategori takibi. */
export function ScaleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 17h12" />
      <path d="M10 17V5" />
      <path d="M10 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      <path d="M4.5 5.5h11" />
      <path d="M2.5 11l2.5-5.5L7.5 11a2.5 2.5 0 01-5 0z" />
      <path d="M12.5 11L15 5.5 17.5 11a2.5 2.5 0 01-5 0z" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 1.5v2M10 16.5v2M3.9 3.9l1.4 1.4M14.7 14.7l1.4 1.4M1.5 10h2M16.5 10h2M3.9 16.1l1.4-1.4M14.7 5.3l1.4-1.4" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2.5l6 2.2v5c0 3.4-2.4 6.4-6 7.8-3.6-1.4-6-4.4-6-7.8v-5l6-2.2z" />
      <path d="M7.5 10l1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="6.5" r="3.5" />
      <path d="M3.5 17.5V16A5.5 5.5 0 019 10.5h2a5.5 5.5 0 015.5 5.5v1.5" />
    </svg>
  );
}

export function FlameIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2.5s4.5 3.2 4.5 7.5a4.5 4.5 0 11-9 0c0-1.7.8-3 1.6-4 .2 1 .8 1.7 1.6 1.7 1.1 0 1.5-1 1.3-2.4-.1-1 0-1.9 0-2.8z" />
    </svg>
  );
}
