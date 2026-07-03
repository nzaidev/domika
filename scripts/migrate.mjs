import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const lines = fs.readFileSync("/tmp/propflow-app.jsx", "utf8").split("\n");

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function transform(code) {
  return code
    .replace(/React\.(useState|useEffect|useRef|useCallback)/g, "$1")
    .replace(/window\.(I18N|AVATARS|PROPERTIES|PROPERTY_PHOTOS|LEADS|Sidebar|Topbar|Reveal|Counter|Landing|Dashboard|Crm|Properties|Detail)\b/g, "$1")
    .replace(/^Object\.assign\(window,[\s\S]*?\);\n?/gm, "")
    .replace(/^window\.\w+ = \w+;\n?/gm, "")
    .replace(/const \{ useState, useEffect \} = React;\n?/, "")
    .replace(/ReactDOM\.createRoot[\s\S]*$/m, "")
    .replace(
      /const TWEAK_DEFAULS = \/\*EDITMODE-BEGIN\*\/[\s\S]*?\/\*EDITMODE-END\*\/;/,
      'const TWEAK_DEFAULTS = { lang: "es" as const };'
    )
    .replace(/TWEAK_DEFAULS/g, "TWEAK_DEFAULTS")
    .replace(/^const \w+ = \([^)]*\) => \(\n?/, "")
    .replace(/^const \w+ = \([^)]*\) => \{\n?/, "")
    .replace(/^const App = \(\) => \{\n/, "")
    .replace(/\};?\s*$/, "");
}

const dirs = [
  "src/lib",
  "src/components/ui",
  "src/components/layout",
  "src/components/tweaks",
  "src/components/views",
];

for (const dir of dirs) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}

const tweaksStyle = slice(4, 95).replace(/^const __TWEAKS_STYLE = `\n?/, "").replace(/`;\s*$/, "");

fs.writeFileSync(
  path.join(root, "src/lib/types.ts"),
  `export type Lang = "es" | "en";

export type Route =
  | "landing"
  | "dashboard"
  | "leads"
  | "properties"
  | "detail"
  | "tasks"
  | "network"
  | "brochures"
  | "settings";

export type Property = {
  id: number;
  photo: string;
  price: string;
  type: string;
  title: string;
  loc: string;
  beds: number;
  baths: number;
  sqm: number;
  status: "active" | "draft";
  shared?: boolean;
  photos: number;
};

export type Lead = {
  id: number;
  name: string;
  zone: string;
  budget: string;
  type: string;
  avatar: string;
};

export type Translations = Record<string, string>;
`
);

fs.writeFileSync(
  path.join(root, "src/lib/i18n.ts"),
  `import type { Lang, Translations } from "./types";

export const I18N: Record<Lang, Translations> = ${slice(372, 645).replace(/^const I18N = /, "")};
`
);

fs.writeFileSync(
  path.join(root, "src/lib/data.ts"),
  `import type { Lead, Property } from "./types";

${slice(702, 757).replace(/^Object\.assign\(window, \{ I18N, Icon, PROPERTY_PHOTOS, AVATARS, LEADS, PROPERTIES \}\);\n?/, "")}
`
);

fs.writeFileSync(
  path.join(root, "src/components/ui/Icon.tsx"),
  `'use client';

import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  name: string;
  size?: number;
};

export function Icon({ name, size = 18, ...rest }: IconProps) {
${transform(slice(647, 700))}
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/ui/Reveal.tsx"),
  `'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

type RevealProps = {
  delay?: number;
  children: ReactNode;
  as?: ElementType;
  className?: string;
  onClick?: () => void;
};

export function Reveal({ delay, children, as: Tag = "div", ...rest }: RevealProps) {
${transform(slice(836, 853))}
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/ui/Counter.tsx"),
  `'use client';

import { useEffect, useRef, useState } from "react";

type CounterProps = {
  to: number;
  suffix?: string;
  duration?: number;
};

export function Counter({ to, suffix = "", duration = 1600 }: CounterProps) {
${transform(slice(855, 879))}
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/tweaks/tweaks.css.ts"),
  `export const TWEAKS_STYLE = \`${tweaksStyle.replace(/\\/g, "\\\\").replace(/`/g, "\\`")}\`;\n`
);

fs.writeFileSync(
  path.join(root, "src/components/tweaks/TweaksPanel.tsx"),
  `'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TWEAKS_STYLE } from "./tweaks.css";

${transform(slice(97, 366))}

export {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton,
};
`
);

fs.writeFileSync(
  path.join(root, "src/components/layout/Sidebar.tsx"),
  `'use client';

import type { Route, Translations } from "@/lib/types";
import { AVATARS } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";

type SidebarProps = {
  active: Route;
  setRoute: (route: Route) => void;
  t: Translations;
};

export function Sidebar({ active, setRoute, t }: SidebarProps) {
${transform(slice(764, 816))}
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/layout/Topbar.tsx"),
  `'use client';

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type TopbarProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
${transform(slice(819, 833))}
  );
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/views/Landing.tsx"),
  `'use client';

import type { Route, Translations } from "@/lib/types";
import { AVATARS } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";

type LandingProps = {
  t: Translations;
  setRoute: (route: Route) => void;
};

export function Landing({ t, setRoute }: LandingProps) {
${transform(slice(886, 1129))}
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/views/Dashboard.tsx"),
  `'use client';

import { useState } from "react";
import type { Property, Route, Translations } from "@/lib/types";
import { PROPERTY_PHOTOS } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";
import { Topbar } from "@/components/layout/Topbar";

type DashboardProps = {
  t: Translations;
  setRoute: (route: Route) => void;
  openProperty: (property: Property) => void;
};

export function Dashboard({ t, setRoute, openProperty }: DashboardProps) {
${transform(slice(1136, 1271))}
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/views/Crm.tsx"),
  `'use client';

import type { Lead, Translations } from "@/lib/types";
import { LEADS } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Topbar } from "@/components/layout/Topbar";

function LeadCard({ lead, t }: { lead: Lead; t: Translations }) {
  return (
${transform(slice(1279, 1302))}
  );
}

export function Crm({ t }: { t: Translations }) {
${transform(slice(1305, 1345))}
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/views/Properties.tsx"),
  `'use client';

import { useState } from "react";
import type { Property, Translations } from "@/lib/types";
import { PROPERTIES } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Topbar } from "@/components/layout/Topbar";

type PropertiesProps = {
  t: Translations;
  openProperty: (property: Property) => void;
};

export function Properties({ t, openProperty }: PropertiesProps) {
${transform(slice(1352, 1426))}
}
`
);

fs.writeFileSync(
  path.join(root, "src/components/views/Detail.tsx"),
  `'use client';

import { useState } from "react";
import type { Property, Route, Translations } from "@/lib/types";
import { AVATARS, PROPERTIES, PROPERTY_PHOTOS } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Topbar } from "@/components/layout/Topbar";

type DetailProps = {
  t: Translations;
  property: Property | null;
  setRoute: (route: Route) => void;
};

export function Detail({ t, property, setRoute }: DetailProps) {
${transform(slice(1433, 1629))}
}
`
);

console.log("Migration complete");
