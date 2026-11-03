// Набор линейных иконок витрины (SVG, stroke = currentColor). Все декоративные: aria-hidden,
// смысл передаёт текст рядом. Компоненты без состояния — годятся и для серверных, и для клиентских.

import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className = "h-6 w-6", strokeWidth = 1.6, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6.5h11v9H3zM14 9.5h3.5l3 3v3H14" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </Icon>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M16 13.5h1.5" />
    </Icon>
  );
}

export function HeadsetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" />
      <rect x="3.5" y="13" width="4" height="6" rx="1.5" />
      <rect x="16.5" y="13" width="4" height="6" rx="1.5" />
      <path d="M18.5 19c0 1.2-1.5 2-4 2h-1.5" />
    </Icon>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20 16-4.5-4.5L6 19.5" />
    </Icon>
  );
}

/* ── Иконки разделов каталога ─────────────────────────────────────────────────────────── */

function AmplifierIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="7" width="19" height="10" rx="1.5" />
      <circle cx="7.5" cy="12" r="2.2" />
      <circle cx="16.5" cy="12" r="2.2" />
      <path d="M11 10.5h2M11 13.5h2M5 17v1.5M19 17v1.5" />
    </Icon>
  );
}

function SpeakerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <circle cx="12" cy="7" r="1.6" />
      <circle cx="12" cy="14.5" r="3.6" />
      <circle cx="12" cy="14.5" r="1" />
    </Icon>
  );
}

function TurntableIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <circle cx="10" cy="12" r="5" />
      <circle cx="10" cy="12" r="1.2" />
      <path d="M18.5 7v6.5l-3 2.5" />
    </Icon>
  );
}

function CableIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3v3M12 3v3" />
      <rect x="6.5" y="6" width="7" height="5" rx="1" />
      <path d="M10 11v3.5a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V8" />
      <path d="M16.5 5.5h3V8h-3z" />
    </Icon>
  );
}

function DacIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" />
      <path d="M9.5 13.5 11 10l1.5 3.5L14 10" />
    </Icon>
  );
}

function HeadphonesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="6.5" rx="1.5" />
      <rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5" />
    </Icon>
  );
}

function WaveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2" />
    </Icon>
  );
}

const CATEGORY_ICONS: { test: RegExp; icon: (props: IconProps) => ReactNode }[] = [
  { test: /headphone|наушн|навушн/, icon: HeadphonesIcon },
  { test: /dac|цап|digital|streamer/, icon: DacIcon },
  { test: /amp|усилит|підсил/, icon: AmplifierIcon },
  { test: /speaker|acoustic|акуст|колонк/, icon: SpeakerIcon },
  { test: /turntable|vinyl|record|проигр|програв|вініл|винил/, icon: TurntableIcon },
  { test: /cable|interconnect|кабел/, icon: CableIcon },
];

/** Иконка раздела по slug/названию (латиница или кириллица); неизвестный раздел — «звуковая волна». */
export function CategoryIcon({ slug, name, ...props }: IconProps & { slug: string; name: string }) {
  const key = `${slug} ${name}`.toLowerCase();
  const Match = CATEGORY_ICONS.find((entry) => entry.test.test(key))?.icon ?? WaveIcon;
  return <Match {...props} />;
}

/** Фирменный знак: стилизованная стрелка VU-метра. */
export function LogoMark(props: IconProps) {
  return (
    <Icon strokeWidth={1.8} {...props}>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M12 16 16 9" />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" />
      <path d="M6.3 11.2 7.4 12M17.7 11.2 16.6 12M12 8v1.3" />
    </Icon>
  );
}
