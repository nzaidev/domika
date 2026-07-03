/* global React, Icon, Reveal, Counter, PROPERTIES, AVATARS */
// Dashboard — Panel Principal

const Dashboard = ({ t, setRoute, openProperty }) => {
  const [tasksDone, setTasksDone] = React.useState({ 2: false, 3: false });
  const toggleTask = (id) => setTasksDone(p => ({ ...p, [id]: !p[id] }));

  const stats = [
    { icon: 'users', tone: 'blue', value: 47, label: t.stat_leads, delta: '+18%', up: true },
    { icon: 'building', tone: 'purple', value: 128, label: t.stat_properties, delta: '+6', up: true },
    { icon: 'tasks', tone: 'yellow', value: 8, label: t.stat_tasks, delta: '3 ahora', up: false, neutral: true },
    { icon: 'star', tone: 'green', value: 9, label: t.stat_closings, delta: '+24%', up: true },
  ];

  const funnel = [
    { label: t.funnel_new, count: 47, pct: 100, color: '#3B82F6' },
    { label: t.funnel_contacted, count: 32, pct: 78, color: '#6366F1' },
    { label: t.funnel_visit, count: 21, pct: 58, color: '#8B5CF6' },
    { label: t.funnel_negotiation, count: 12, pct: 36, color: '#EC4899' },
    { label: t.funnel_closing, count: 5, pct: 18, color: '#E11D2A' },
  ];

  const activity = [
    { photo: window.PROPERTY_PHOTOS[0], title: 'Penthouse con vista al mar — compartida con Diego F.', meta: 'Cap Cana · $485,000', time: 'hace 12m' },
    { photo: window.PROPERTY_PHOTOS[2], title: 'Villa con piscina infinita — nueva visita programada', meta: 'Casa de Campo · $610,000', time: 'hace 1h' },
    { photo: window.PROPERTY_PHOTOS[4], title: 'Penthouse Anacaona — brochure enviado a Lucía M.', meta: 'Anacaona · $890,000', time: 'hace 3h' },
    { photo: window.PROPERTY_PHOTOS[1], title: 'Torre Vista Real — publicada en portal externo', meta: 'Piantini · $320,000', time: 'hace 5h' },
  ];

  const tasks = [
    { id: 1, title: 'Llamar a Sofía Ramírez · cierre Cap Cana', time: '10:30 · hoy', priority: 'high' },
    { id: 2, title: 'Enviar brochure a Roberto Silva', time: '12:00 · hoy', priority: 'med' },
    { id: 3, title: 'Visita con Lucía Mendoza · Penthouse Anacaona', time: '16:00 · hoy', priority: 'high' },
    { id: 4, title: 'Renovar contrato propietario · Villa Bávaro', time: 'mañana', priority: 'low' },
    { id: 5, title: 'Coordinar fotos profesionales · Loft Naco', time: 'mañana', priority: 'med' },
  ];

  return (
    <div className="page">
      <Topbar
        title={t.dash_greeting + ' 👋'}
        subtitle={t.dash_subtitle}
        actions={
          <button className="btn btn--primary"><Icon name="plus" size={16} /> {t.new_property_btn}</button>
        }
      />
      <div className="content">
        {/* STATS */}
        <div className="stat-grid">
          {stats.map((s, i) => (
            <Reveal key={i} delay={i + 1} as="div" className="reveal stat-card">
              <div className="stat-card__head">
                <div className={`stat-card__icon stat-card__icon--${s.tone}`}><Icon name={s.icon} size={18} /></div>
                <span className={`stat-card__delta ${s.neutral ? '' : (s.up ? 'stat-card__delta--up' : 'stat-card__delta--down')}`}>
                  {!s.neutral && (s.up ? '▲ ' : '▼ ')}{s.delta}
                </span>
              </div>
              <div className="stat-card__value"><Counter to={s.value} /></div>
              <div className="stat-card__label">{s.label}</div>
              <svg className="stat-card__spark" viewBox="0 0 80 36" preserveAspectRatio="none">
                <path d={`M0,30 Q15,${20 + i * 2} 30,${24 - i} T60,${15 - i * 2} T80,${10 + i}`} fill="none" stroke={`var(--accent)`} strokeWidth="2" />
              </svg>
            </Reveal>
          ))}
        </div>

        {/* FUNNEL + TASKS */}
        <div className="dash-grid">
          <Reveal as="div" className="reveal panel">
            <div className="panel__head">
              <div>
                <div className="panel__title">{t.funnel_title}</div>
                <div className="panel__sub">{t.funnel_sub}</div>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setRoute('leads')}>{t.view_all} <Icon name="arrow_right" size={14} /></button>
            </div>
            <div className="funnel">
              {funnel.map((f, i) => (
                <div key={i} className="funnel__row">
                  <div className="funnel__label">{f.label}</div>
                  <div className="funnel__bar" style={{ width: f.pct + '%', background: f.color }}>
                    {f.count} leads
                  </div>
                  <div className="funnel__count">{f.pct}%</div>
                </div>
              ))}
            </div>

            <div className="panel__head" style={{ marginTop: 28, marginBottom: 16 }}>
              <div>
                <div className="panel__title">{t.activity_title}</div>
              </div>
            </div>
            <div className="activity">
              {activity.map((a, i) => (
                <div key={i} className="activity__item">
                  <div className="activity__thumb" style={{ backgroundImage: `url(${a.photo})` }} />
                  <div className="activity__body">
                    <div className="activity__title">{a.title}</div>
                    <div className="activity__meta">{a.meta}</div>
                  </div>
                  <div className="activity__time">{a.time}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={2} as="div" className="reveal panel">
            <div className="panel__head">
              <div>
                <div className="panel__title">{t.tasks_title}</div>
                <div className="panel__sub">{t.tasks_sub}</div>
              </div>
              <button className="btn btn--ghost btn--icon btn--sm"><Icon name="plus" size={14} /></button>
            </div>
            <div className="task-list">
              {tasks.map(task => (
                <div key={task.id} className={'task-item' + (tasksDone[task.id] ? ' is-done' : '')}>
                  <div className={`task-priority task-priority--${task.priority}`} />
                  <div className={'task-check' + (tasksDone[task.id] ? ' is-done' : '')} onClick={() => toggleTask(task.id)}>
                    {tasksDone[task.id] && <Icon name="check" size={12} />}
                  </div>
                  <div className="task-title">{task.title}</div>
                  <div className="task-time">{task.time}</div>
                </div>
              ))}
            </div>

            {/* Mini CTA card */}
            <div style={{ marginTop: 20, padding: 18, background: 'var(--rand-navy)', borderRadius: 14, color: '#fff', backgroundImage: 'radial-gradient(ellipse at top right, rgba(225,29,42,0.25), transparent 60%)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                <span className="highlight-yellow" style={{ color: 'var(--rand-navy)' }}>3 leads</span> sin contactar
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', marginBottom: 14 }}>Asígnalos antes que se enfríen.</div>
              <button className="btn btn--primary btn--sm" onClick={() => setRoute('leads')}>Ir al pipeline <Icon name="arrow_right" size={12} /></button>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
