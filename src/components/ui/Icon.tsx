'use client';

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  name: string;
  size?: number;
};

export function Icon({ name, size = 18, ...rest }: IconProps) {
  const paths = {
    home: <><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    users: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5c2.5 0 5 1.5 5.5 4"/></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/></>,
    check: <><polyline points="4 12 10 18 20 6"/></>,
    tasks: <><rect x="4" y="4" width="16" height="16" rx="2.5"/><polyline points="8 12 11 15 16 9"/></>,
    network: <><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><circle cx="12" cy="6" r="2.5"/><path d="M11 8l-4 8M13 8l4 8M8 18h8"/></>,
    brochure: <><path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10.5 21a1.5 1.5 0 0 0 3 0"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    arrow_right: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></>,
    arrow_up: <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/></>,
    arrow_down: <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/></>,
    arrow_left: <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/></>,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z"/></>,
    whatsapp: <><path d="M16.5 13.5c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1l-1 1.2c-.2.2-.4.3-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.4.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.2 3.1c.2.2 2.1 3.1 5 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4z"/><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    location: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
    bed: <><path d="M2 18v-7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v7"/><line x1="2" y1="14" x2="22" y2="14"/><line x1="2" y1="18" x2="2" y2="20"/><line x1="22" y1="18" x2="22" y2="20"/></>,
    bath: <><path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M5 12V7a2 2 0 0 1 4 0"/><line x1="3" y1="20" x2="3" y2="22"/><line x1="21" y1="20" x2="21" y2="22"/></>,
    sqm: <><rect x="4" y="4" width="16" height="16" rx="1"/><line x1="4" y1="9" x2="9" y2="9"/><line x1="9" y1="4" x2="9" y2="9"/></>,
    car: <><path d="M5 17h14M5 17v-3.5L7 8h10l2 5.5V17M5 17v2h2v-2M19 17v2h-2v-2"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M9 14c0 1 1 2 3 2s3-.7 3-2-1-1.5-3-2-3-1-3-2 1-2 3-2 3 .7 3 2"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></>,
    star: <><polygon points="12 3 14.6 8.6 21 9.5 16.5 14 17.6 20.5 12 17.4 6.4 20.5 7.5 14 3 9.5 9.4 8.6 12 3"/></>,
    heart: <><path d="M20.8 5.6a5 5 0 0 0-7-.6L12 6.5l-1.8-1.5a5 5 0 0 0-7 7l8.8 8 8.8-8a5 5 0 0 0 0-6.4z"/></>,
    photo: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><polyline points="3 17 9 11 13 15 17 12 21 17"/></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    share: <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><line x1="8" y1="11" x2="16" y2="7"/><line x1="8" y1="13" x2="16" y2="17"/></>,
    edit: <><path d="M16 3l5 5-12 12H4v-5z"/></>,
    publish: <><path d="M12 19V5"/><polyline points="6 11 12 5 18 11"/><line x1="4" y1="21" x2="20" y2="21"/></>,
    sparkle: <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/></>,
    bolt: <><polygon points="13 3 4 14 12 14 11 21 20 10 12 10"/></>,
    chart: <><path d="M3 21h18"/><rect x="6" y="13" width="3" height="6"/><rect x="11" y="9" width="3" height="10"/><rect x="16" y="5" width="3" height="14"/></>,
    pipeline: <><rect x="3" y="4" width="4" height="16" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="12" width="4" height="8" rx="1"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    wifi: <><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/></>,
    pool: <><path d="M3 16c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1"/><path d="M3 20c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1"/><path d="M7 13V6a2 2 0 0 1 4 0v7M13 13V6a2 2 0 0 1 4 0v7"/></>,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><polyline points="9 12 11 14 15 10"/></>,
    elevator: <><rect x="5" y="3" width="14" height="18" rx="1.5"/><polyline points="9 9 12 6 15 9"/><polyline points="9 15 12 18 15 15"/></>,
    cube: <><path d="M12 3l8 4v10l-8 4-8-4V7z"/><polyline points="4 7 12 11 20 7"/><line x1="12" y1="11" x2="12" y2="21"/></>,
    filter: <><path d="M3 5h18l-7 8v6l-4 2v-8z"/></>,
    dots: <><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name]}
    </svg>
  );

}
