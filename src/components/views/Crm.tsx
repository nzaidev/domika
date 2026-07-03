'use client';

import type { Lead, Translations } from "@/lib/types";
import { LEADS } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { Topbar } from "@/components/layout/Topbar";

function LeadCard({ lead, t }: { lead: Lead; t: Translations }) {
  return (
  <div className="lead-card">
    <div className="lead-card__head">
      <div className="lead-card__avatar" style={{ backgroundImage: `url(${lead.avatar})` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="lead-card__name">{lead.name}</div>
        <div className="lead-card__zone">{lead.zone}</div>
      </div>
    </div>
    <div className="lead-card__meta">
      <div className="lead-card__meta-row">
        <Icon name="building" size={13} />
        <span>{lead.type}</span>
      </div>
      <div className="lead-card__meta-row">
        <Icon name="money" size={13} />
        <span className="lead-card__budget">{lead.budget}</span>
      </div>
    </div>
    <div className="lead-card__actions">
      <button className="lead-action lead-action--call"><Icon name="phone" size={12} />{t.lead_call}</button>
      <button className="lead-action lead-action--whatsapp"><Icon name="whatsapp" size={12} />WhatsApp</button>
      <button className="lead-action"><Icon name="send" size={12} />{t.lead_send}</button>
    </div>
  </div>
  );
}

export function Crm({ t }: { t: Translations }) {
  const cols = [
    { key: 'nuevo', label: t.funnel_new, color: '#3B82F6' },
    { key: 'contactado', label: t.funnel_contacted, color: '#6366F1' },
    { key: 'visita', label: t.funnel_visit, color: '#8B5CF6' },
    { key: 'negociacion', label: t.funnel_negotiation, color: '#EC4899' },
    { key: 'cierre', label: t.funnel_closing, color: '#E11D2A' },
  ];

  return (
    <div className="page">
      <Topbar
        title={t.crm_title}
        subtitle={t.crm_sub}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--outline btn--sm"><Icon name="filter" size={14} />{t.crm_filter}</button>
            <button className="btn btn--primary"><Icon name="plus" size={16} />{t.crm_new_lead}</button>
          </div>
        }
      />
      <div className="content">
        <Reveal>
          <div className="kanban">
            {cols.map((c) => (
              <div key={c.key} className="kanban__col">
                <div className="kanban__col-head">
                  <div className="kanban__col-pip" style={{ background: c.color }} />
                  <div className="kanban__col-title">{c.label}</div>
                  <span className="kanban__col-count">{LEADS[c.key].length}</span>
                  <button className="kanban__col-add"><Icon name="plus" size={12} /></button>
                </div>
                {LEADS[c.key].map(lead => <LeadCard key={lead.id} lead={lead} t={t} />)}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );

}
