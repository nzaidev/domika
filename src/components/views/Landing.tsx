'use client';

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
  return (
    <div className="landing page">
      {/* NAV */}
      <nav className="landing__nav">
        <div className="landing__nav-inner">
          <div className="landing__brand">
            <div className="landing__brand-mark">P</div>
            PropFlow
          </div>
          <div className="landing__nav-links">
            <a className="landing__nav-link" href="#features">{t.nav_features}</a>
            <a className="landing__nav-link" href="#stats">{t.nav_clients}</a>
            <a className="landing__nav-link" href="#pricing">{t.nav_pricing}</a>
          </div>
          <div className="landing__nav-cta">
            <button className="btn btn--ghost btn--sm" onClick={() => setRoute('dashboard')}>{t.nav_login}</button>
            <button className="btn btn--primary btn--sm" onClick={() => setRoute('dashboard')}>{t.cta_demo}</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero__visual-bg" />
        <div className="hero__inner">
          <div>
            <Reveal>
              <div className="hero__pill">
                <span className="hero__pill-tag">{t.hero_pill_tag}</span>
                {t.hero_pill}
              </div>
            </Reveal>
            <Reveal delay={1}>
              <h1 className="hero__title">
                {t.hero_title_a} <span className="highlight-yellow">{t.hero_title_b}</span> {t.hero_title_c}
              </h1>
            </Reveal>
            <Reveal delay={2}>
              <p className="hero__sub">{t.hero_sub}</p>
            </Reveal>
            <Reveal delay={3}>
              <div className="hero__cta-row">
                <button className="btn btn--primary btn--lg" onClick={() => setRoute('dashboard')}>
                  {t.cta_demo} <Icon name="arrow_right" size={16} />
                </button>
                <button className="btn btn--outline btn--lg">{t.cta_features}</button>
              </div>
            </Reveal>
            <Reveal delay={4}>
              <div className="hero__feature-pills">
                {[t.feat_pill_1, t.feat_pill_2, t.feat_pill_3, t.feat_pill_4, t.feat_pill_5].map((p, i) => (
                  <span key={i} className="hero__pill-feature">
                    <Icon name="check" size={12} /> {p}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Hero visual */}
          <div className="hero__visual">
            <div className="hero__dashboard-card hero__dashboard-main">
              <div className="mini-dash__topbar">
                <div className="mini-dash__dot"></div>
                <div className="mini-dash__dot"></div>
                <div className="mini-dash__dot"></div>
                <div className="mini-dash__url">app.propflow.io/dashboard</div>
              </div>
              <div className="mini-dash__body">
                <div className="mini-dash__title">{t.dash_greeting} 👋</div>
                <div className="mini-dash__stats">
                  <div className="mini-dash__stat">
                    <div className="mini-dash__stat-label">Leads</div>
                    <div className="mini-dash__stat-value">47</div>
                  </div>
                  <div className="mini-dash__stat">
                    <div className="mini-dash__stat-label">Activas</div>
                    <div className="mini-dash__stat-value">128</div>
                  </div>
                  <div className="mini-dash__stat">
                    <div className="mini-dash__stat-label">Cierres</div>
                    <div className="mini-dash__stat-value">9</div>
                  </div>
                </div>
                <div className="mini-dash__bars">
                  {[35, 55, 42, 68, 80, 60, 75, 90, 72, 85, 95, 78].map((h, i) => (
                    <div key={i} className="mini-dash__bar" style={{ height: h + '%' }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="hero__dashboard-card hero__stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="stat-card__icon stat-card__icon--green"><Icon name="arrow_up" size={16} /></div>
                <span className="stat-card__delta stat-card__delta--up">+24%</span>
              </div>
              <div className="stat-card__value">$1.2M</div>
              <div className="stat-card__label">Pipeline activo</div>
            </div>

            <div className="hero__dashboard-card hero__lead-card">
              <div className="lead-card__head">
                <div className="lead-card__avatar" style={{ backgroundImage: `url(${AVATARS[1]})` }} />
                <div>
                  <div className="lead-card__name">Lucía Mendoza</div>
                  <div className="lead-card__zone">Costa Este · Penthouse</div>
                </div>
              </div>
              <div className="lead-card__budget">$540K</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 4 }}>Visita programada · Mañana 4:00pm</div>
            </div>

            <div className="hero__mobile">
              <div className="mobile-mock">
                <div className="mobile-mock__screen">
                  <div className="mobile-mock__notch"><div className="mobile-mock__notch-pill" /></div>
                  <div className="mobile-mock__content">
                    <div className="mobile-mock__head">
                      <div>
                        <div className="mobile-mock__greet">{t.m_morning}</div>
                        <div className="mobile-mock__name">Carolina</div>
                      </div>
                      <div className="mobile-mock__avatar" />
                    </div>
                    <div className="mobile-mock__card">
                      <div className="mobile-mock__card-label">{t.m_pipeline}</div>
                      <div className="mobile-mock__card-value">$1.2M</div>
                    </div>
                    <div className="mobile-mock__card">
                      <div className="mobile-mock__card-label">{t.m_leads} · {t.today}</div>
                      <div className="mobile-mock__card-value">12</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <div style={{ flex: 1, height: 24, background: 'var(--rand-red)', borderRadius: 6 }} />
                      <div style={{ width: 24, height: 24, background: 'var(--bg-tint)', borderRadius: 6 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="strip-stats" id="stats">
        <div className="strip-stats__inner">
          <Reveal as="div" className="reveal strip-stat">
            <div className="strip-stat__num"><Counter to={2400} suffix="+" /></div>
            <div className="strip-stat__label">{t.stat_1_label}</div>
          </Reveal>
          <Reveal delay={1} as="div" className="reveal strip-stat">
            <div className="strip-stat__num"><Counter to={48000} suffix="+" /></div>
            <div className="strip-stat__label">{t.stat_2_label}</div>
          </Reveal>
          <Reveal delay={2} as="div" className="reveal strip-stat">
            <div className="strip-stat__num"><Counter to={1280} suffix="+" /></div>
            <div className="strip-stat__label">{t.stat_3_label}</div>
          </Reveal>
          <Reveal delay={3} as="div" className="reveal strip-stat">
            <div className="strip-stat__num"><Counter to={38} /><span className="unit">%</span></div>
            <div className="strip-stat__label">{t.stat_4_label}</div>
          </Reveal>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="section__inner">
          <div className="section__head">
            <Reveal><span className="eyebrow">{t.feat_eyebrow}</span></Reveal>
            <Reveal delay={1}><h2 className="h2">{t.feat_title}</h2></Reveal>
            <Reveal delay={2}><p className="muted">{t.feat_sub}</p></Reveal>
          </div>
          <div className="features">
            {[
              { icon: 'pipeline', title: t.f1_title, desc: t.f1_desc },
              { icon: 'building', title: t.f2_title, desc: t.f2_desc },
              { icon: 'network', title: t.f3_title, desc: t.f3_desc },
              { icon: 'brochure', title: t.f4_title, desc: t.f4_desc },
              { icon: 'bolt', title: t.f5_title, desc: t.f5_desc },
              { icon: 'chart', title: t.f6_title, desc: t.f6_desc },
            ].map((f, i) => (
              <Reveal key={i} delay={(i % 3) + 1} as="div" className="reveal feature">
                <div className="feature__icon"><Icon name={f.icon} size={22} /></div>
                <div className="feature__title">{f.title}</div>
                <div className="feature__desc">{f.desc}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <Reveal><h2 className="h2">{t.cta_section_title}</h2></Reveal>
        <Reveal delay={1}><p className="muted">{t.cta_section_sub}</p></Reveal>
        <Reveal delay={2}>
          <button className="btn btn--primary btn--lg" onClick={() => setRoute('dashboard')}>
            {t.cta_section_btn} <Icon name="arrow_right" size={16} />
          </button>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand-block">
            <div className="landing__brand" style={{ color: '#fff', marginBottom: 16 }}>
              <div className="landing__brand-mark" style={{ background: 'var(--rand-red)' }}>P</div>
              PropFlow
            </div>
            <div>{t.footer_tag}</div>
          </div>
          <div className="footer__col">
            <div className="footer__col-title">{t.footer_product}</div>
            <a href="#">{t.nav_features}</a>
            <a href="#">{t.nav_pricing}</a>
            <a href="#">CRM</a>
            <a href="#">Brochures</a>
          </div>
          <div className="footer__col">
            <div className="footer__col-title">{t.footer_company}</div>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Careers</a>
          </div>
          <div className="footer__col">
            <div className="footer__col-title">{t.footer_resources}</div>
            <a href="#">Help</a>
            <a href="#">API</a>
            <a href="#">Status</a>
          </div>
        </div>
        <div className="footer__bottom">
          <div>{t.footer_rights}</div>
          <div>v1.0 · Powered by Rand</div>
        </div>
      </footer>
    </div>
  );

}
