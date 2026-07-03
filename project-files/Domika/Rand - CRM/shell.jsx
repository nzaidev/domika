/* global React, Icon, I18N */
// Sidebar + topbar shell

const Sidebar = ({ active, setRoute, t }) => {
  const items = [
    { id: 'landing', label: t.nav_landing, icon: 'home' },
    { id: 'dashboard', label: t.nav_dashboard, icon: 'dashboard' },
    { id: 'leads', label: t.nav_leads, icon: 'users', badge: '12' },
    { id: 'properties', label: t.nav_properties, icon: 'building' },
    { id: 'detail', label: 'Detalle', icon: 'photo', hidden: true },
  ];
  const secondary = [
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
        <div className="sidebar__avatar" style={{ backgroundImage: `url(${window.AVATARS[0]})` }} />
        <div className="sidebar__user-info">
          <div className="sidebar__user-name">Carolina Méndez</div>
          <div className="sidebar__user-role">Agente Senior</div>
        </div>
      </div>
    </aside>
  );
};

const Topbar = ({ title, subtitle, actions }) => (
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

// Reveal-on-scroll wrapper
const Reveal = ({ delay, children, as: Tag = 'div', ...rest }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={'reveal' + (delay ? ` reveal--delay-${delay}` : '')} {...rest}>{children}</Tag>;
};

// Animated counter
const Counter = ({ to, suffix = '', duration = 1600 }) => {
  const [val, setVal] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(to * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

Object.assign(window, { Sidebar, Topbar, Reveal, Counter });
