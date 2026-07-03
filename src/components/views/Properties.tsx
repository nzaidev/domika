'use client';

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
  const [tab, setTab] = useState('all');
  const tabs = [
    { id: 'all', label: t.prop_all },
    { id: 'active', label: t.prop_active },
    { id: 'shared', label: t.prop_shared },
    { id: 'draft', label: t.prop_drafts },
  ];
  const filtered = PROPERTIES.filter(p => {
    if (tab === 'all') return true;
    if (tab === 'shared') return p.shared;
    return p.status === tab;
  });

  return (
    <div className="page">
      <Topbar
        title={t.prop_title}
        subtitle={t.prop_sub}
        actions={
          <button className="btn btn--primary"><Icon name="plus" size={16} />{t.new_property_btn}</button>
        }
      />
      <div className="content">
        <div className="prop-toolbar">
          <div className="prop-tabs">
            {tabs.map(tb => (
              <button key={tb.id}
                className={'prop-tab' + (tab === tb.id ? ' prop-tab--active' : '')}
                onClick={() => setTab(tb.id)}>
                {tb.label}
              </button>
            ))}
          </div>
          <button className="btn btn--outline btn--sm" style={{ marginLeft: 'auto' }}><Icon name="filter" size={14} /> Filtrar</button>
          <button className="btn btn--ghost btn--icon btn--sm"><Icon name="dots" size={14} /></button>
        </div>

        <div className="prop-grid">
          {filtered.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) + 1} as="div" className="reveal prop-card" onClick={() => openProperty(p)}>
              <div className="prop-card__photo" style={{ backgroundImage: `url(${p.photo})` }}>
                <div className="prop-card__photo-tags">
                  {p.status === 'active' && <span className="badge badge--success badge--dot">{t.badge_active}</span>}
                  {p.status === 'draft' && <span className="badge badge--warning badge--dot">{t.badge_draft}</span>}
                  {p.shared && <span className="badge badge--info badge--dot">{t.badge_shared}</span>}
                </div>
                <button className="prop-card__fav" onClick={(e) => e.stopPropagation()}><Icon name="heart" size={16} /></button>
                <div className="prop-card__photo-count"><Icon name="photo" size={11} />{p.photos}</div>
              </div>
              <div className="prop-card__body">
                <div className="prop-card__price-row">
                  <div className="prop-card__price">{p.price}</div>
                  <div className="prop-card__type">{p.type}</div>
                </div>
                <div className="prop-card__title">{p.title}</div>
                <div className="prop-card__loc"><Icon name="location" size={12} />{p.loc}</div>
                <div className="prop-card__specs">
                  <div className="prop-spec"><Icon name="bed" size={14} />{p.beds} {t.bedrooms}</div>
                  <div className="prop-spec"><Icon name="bath" size={14} />{p.baths} {t.bathrooms}</div>
                  <div className="prop-spec"><Icon name="sqm" size={14} />{p.sqm} {t.sqm}</div>
                </div>
              </div>
              <div className="prop-card__actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn--ghost"><Icon name="brochure" size={12} />{t.prop_action_brochure}</button>
                <button className="btn btn--ghost"><Icon name="share" size={12} />{t.prop_action_share}</button>
                <button className="btn btn--ghost"><Icon name="publish" size={12} />{t.prop_action_publish}</button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );

}
