'use client';

import type { Route, Translations } from "@/lib/types";
import { AVATARS } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";

type SidebarProps = {
  active: Route;
  setRoute: (route: Route) => void;
  t: Translations;
};

export function Sidebar({ active, setRoute, t }: SidebarProps) {
  const items: Array<{
    id: Route;
    label: string;
    icon: string;
    badge?: string;
    hidden?: boolean;
  }> = [
    { id: 'landing', label: t.nav_landing, icon: 'home' },
    { id: 'dashboard', label: t.nav_dashboard, icon: 'dashboard' },
    { id: 'leads', label: t.nav_leads, icon: 'users', badge: '12' },
    { id: 'properties', label: t.nav_properties, icon: 'building' },
    { id: 'detail', label: 'Detalle', icon: 'photo', hidden: true },
  ];
  const secondary: Array<{ id: Route; label: string; icon: string }> = [
    { id: 'tasks', label: t.nav_tasks, icon: 'tasks' },
    { id: 'network', label: t.nav_network, icon: 'network' },
    { id: 'brochures', label: t.nav_brochures, icon: 'brochure' },
    { id: 'settings', label: t.nav_settings, icon: 'settings' },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">P</div>
        <div>
          <div className="sidebar__name">PropFlow</div>
          <div className="sidebar__tag">by Rand</div>
        </div>
      </div>
      <div className="sidebar__nav">
        {items.filter(i => !i.hidden).map(i => (
          <button key={i.id}
            className={'sidebar__item' + (active === i.id || (i.id === 'properties' && active === 'detail') ? ' sidebar__item--active' : '')}
            onClick={() => setRoute(i.id)}>
            <Icon name={i.icon} className="sidebar__item-icon" />
            <span>{i.label}</span>
            {i.badge && <span className="sidebar__badge">{i.badge}</span>}
          </button>
        ))}
      </div>
      <div className="sidebar__section">Workspace</div>
      <div className="sidebar__nav">
        {secondary.map(i => (
          <button key={i.id} className="sidebar__item" onClick={() => setRoute(i.id)}>
            <Icon name={i.icon} className="sidebar__item-icon" />
            <span>{i.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar__user">
        <div className="sidebar__avatar" style={{ backgroundImage: `url(${AVATARS[0]})` }} />
        <div className="sidebar__user-info">
          <div className="sidebar__user-name">Carolina Méndez</div>
          <div className="sidebar__user-role">Agente Senior</div>
        </div>
      </div>
    </aside>
  );

}
