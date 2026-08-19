"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./domika-app.module.css";
import {
  BellIcon,
  BrandMark,
  BuildingIcon,
  ChatIcon,
  ChevronIcon,
  ContractIcon,
  FileIcon,
  GearIcon,
  HelpIcon,
  HomeIcon,
  MegaphoneIcon,
  NetworkIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  TargetIcon,
  TaskIcon,
  UsersIcon,
  type IconProps,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.ReactElement;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Escritorio", Icon: HomeIcon },
  { href: "/conversations", label: "Conversaciones", Icon: ChatIcon },
  { href: "/leads", label: "Prospectos", Icon: UsersIcon },
  { href: "/tags", label: "Etiquetas", Icon: TagIcon },
  { href: "/properties", label: "Propiedades", Icon: BuildingIcon },
  { href: "/listings", label: "Promoción", Icon: MegaphoneIcon },
  { href: "/brochures", label: "Folletos", Icon: FileIcon },
  { href: "/contracts", label: "Contratos", Icon: ContractIcon },
  { href: "/network", label: "Red de agentes", Icon: NetworkIcon },
  { href: "/matching", label: "Coincidencias", Icon: TargetIcon },
  { href: "/tasks", label: "Tareas", Icon: TaskIcon },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DomikaAppShell({
  children,
  unreadNotifications = 0,
}: {
  children: React.ReactNode;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/dashboard" aria-label="Domika">
          <span className={styles.brandMark}>
            <BrandMark />
          </span>
          <span className={styles.brandWord}>domika</span>
        </Link>

        <button
          className={styles.collapseToggle}
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <ChevronIcon direction={collapsed ? "right" : "left"} />
        </button>

        <nav className={styles.navStack} aria-label="Navegación principal">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? `${styles.navLink} ${styles.navLinkActive}`
                    : styles.navLink
                }
                href={item.href}
                key={item.href}
                title={item.label}
              >
                <span className={styles.navIcon}>
                  <item.Icon />
                </span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarSpacer} />
        <div className={styles.navDivider} />

        <Link
          aria-current={
            isActivePath(pathname, "/settings") ? "page" : undefined
          }
          className={
            isActivePath(pathname, "/settings")
              ? `${styles.navLink} ${styles.navLinkActive}`
              : styles.navLink
          }
          href="/settings"
          title="Configuración"
        >
          <span className={styles.navIcon}>
            <GearIcon />
          </span>
          <span className={styles.navLabel}>Configuración</span>
        </Link>

        <div className={styles.sidebarFoot}>
          <UserButton
            appearance={{ elements: { avatarBox: { width: 34, height: 34 } } }}
          />
          <div className={styles.profileMeta}>
            <strong>Mi cuenta</strong>
            <span>Domika</span>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topRail}>
          <form
            className={styles.searchBox}
            role="search"
            method="get"
            action="/search"
          >
            <SearchIcon />
            <input
              className={styles.searchInput}
              type="search"
              name="q"
              placeholder="Buscar prospectos y propiedades"
              aria-label="Buscar prospectos y propiedades"
            />
            <span className={styles.searchKbd}>⌘K</span>
          </form>
          <div className={styles.topActions}>
            <Link
              className={styles.addButtonRound}
              href="/properties/new"
              aria-label="Nueva propiedad"
            >
              <PlusIcon />
            </Link>
            <Link
              className={styles.iconButtonRound}
              href="/notifications"
              aria-label={`Notificaciones${unreadNotifications > 0 ? ` (${unreadNotifications} sin leer)` : ""}`}
            >
              <BellIcon />
              {unreadNotifications > 0 ? (
                <span className={styles.bellDot}>
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            <Link
              className={styles.iconButtonRound}
              href="/leads/import"
              aria-label="Importar contactos"
            >
              <HelpIcon />
            </Link>
            <Link className={styles.secondaryButton} href="/leads/import">
              Importar
            </Link>
            <Link className={styles.primaryButton} href="/properties/new">
              Nueva propiedad
            </Link>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
