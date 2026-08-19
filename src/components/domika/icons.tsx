import type { ReactElement } from "react";

// Line icons (stroke 2, currentColor) for the CRM shell and dashboard.

export type IconProps = { size?: number };

function Svg({
  size = 20,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BrandMark({ size = 26 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 11.5 12 4l9 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10.5V20h14v-9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
  </Svg>
);

export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.5M21 20a6 6 0 0 0-4-5.6" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </Svg>
);

export const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11V4h7l10 10-7 7L3 11Z" />
    <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const BuildingIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21V6l7-3 7 3v15" />
    <path d="M9 21v-4h6v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01" />
  </Svg>
);

export const MegaphoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1Z" />
    <path d="M19 8a4 4 0 0 1 0 8" />
  </Svg>
);

export const FileIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h8l4 4v14H6Z" />
    <path d="M14 3v4h4M9 13h6M9 17h6" />
  </Svg>
);

export const ContractIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h8l4 4v14H6Z" />
    <path d="M14 3v4h4M9 12h4M9 16h6" />
    <path d="M8 8h2" />
  </Svg>
);

export const NetworkIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="7" r="2.5" />
    <circle cx="18" cy="7" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M8 8.5 11 15M16 8.5 13 15" />
  </Svg>
);

export const TargetIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const TaskIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="m8.5 12 2.5 2.5L16 9" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg size={18} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg size={20} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg size={18} {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);

export const HelpIcon = (p: IconProps) => (
  <Svg size={18} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" />
    <path d="M12 17h.01" />
  </Svg>
);

export function ChevronIcon({
  direction = "left",
  size = 18,
}: IconProps & { direction?: "left" | "right" }): ReactElement {
  return (
    <Svg size={size}>
      {direction === "left" ? (
        <path d="m14 6-6 6 6 6" />
      ) : (
        <path d="m10 6 6 6-6 6" />
      )}
    </Svg>
  );
}
