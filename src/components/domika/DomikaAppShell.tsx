"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./domika-app.module.css";

const navItems = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/leads", label: "Prospectos" },
  { href: "/properties", label: "Propiedades" },
  { href: "/listings", label: "Promoción" },
  { href: "/brochures", label: "Folletos" },
  { href: "/network", label: "Red de agentes" },
  { href: "/tasks", label: "Tareas" },
  { href: "/settings", label: "Ajustes" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DomikaAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/dashboard" aria-label="Domika">
          <Image
            src="/brand/domika-logo-light.jpeg"
            alt="Domika"
            className={styles.brandImage}
            width={1600}
            height={1033}
            priority
          />
        </Link>
        <nav className={styles.navStack} aria-label="Navegación principal">
          {navItems.map((item) => (
            <Link
              aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
              className={
                isActivePath(pathname, item.href)
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
              href={item.href}
              key={item.href}
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <span>Domika Inmobiliaria</span>
          <strong>Espacio de propietario</strong>
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.topRail}>
          <Link
            className={styles.brandCompact}
            href="/dashboard"
            aria-label="Domika"
          >
            <Image
              src="/brand/domika-logo-light.jpeg"
              alt="Domika"
              className={styles.brandImage}
              width={1600}
              height={1033}
              priority
            />
          </Link>
          <form
            className={styles.searchBox}
            role="search"
            method="get"
            action="/search"
          >
            <input
              className={styles.searchInput}
              type="search"
              name="q"
              placeholder="Buscar prospectos y propiedades"
              aria-label="Buscar prospectos y propiedades"
            />
          </form>
          <div className={styles.topActions}>
            <Link className={styles.secondaryButton} href="/leads/import">
              Importar
            </Link>
            <Link className={styles.primaryButton} href="/properties/new">
              Nueva propiedad
            </Link>
            <UserButton />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
