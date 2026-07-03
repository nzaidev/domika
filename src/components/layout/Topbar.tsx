'use client';

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type TopbarProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
  <header className="topbar">
    <div>
      <div className="topbar__title">{title}</div>
      {subtitle && <div className="topbar__sub">{subtitle}</div>}
    </div>
    <div className="topbar__search">
      <Icon name="search" size={16} />
      <span>Buscar propiedades, leads, agentes…</span>
    </div>
    <div className="topbar__icons">
      <button className="topbar__icon"><Icon name="bell" size={18} /><span className="topbar__icon-dot" /></button>
      <button className="topbar__icon"><Icon name="sparkle" size={18} /></button>
    </div>
    {actions}
  </header>
  );
}
