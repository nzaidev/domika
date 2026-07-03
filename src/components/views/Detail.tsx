'use client';

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
  const p = property || PROPERTIES[0];
  const [shareSettings, setShareSettings] = useState({
    photos: true, location: true, owner: false, price: true, brochure: true,
  });
  const toggle = (k) => setShareSettings(s => ({ ...s, [k]: !s[k] }));

  const galleryImgs = [
    p.photo,
    PROPERTY_PHOTOS[1],
    PROPERTY_PHOTOS[5],
    PROPERTY_PHOTOS[2],
    PROPERTY_PHOTOS[4],
  ];

  const amenities = [
    { icon: 'pool', label: t.amen_pool },
    { icon: 'cube', label: t.amen_gym },
    { icon: 'shield', label: t.amen_security },
    { icon: 'car', label: t.amen_parking },
    { icon: 'elevator', label: t.amen_elevator },
    { icon: 'building', label: t.amen_terrace },
    { icon: 'wifi', label: t.amen_smart },
    { icon: 'pool', label: t.amen_jacuzzi },
  ];

  return (
    <div className="page">
      <Topbar
        title={p.title}
        subtitle={<><Icon name="location" size={12} style={{ verticalAlign: 'middle' }} /> {p.loc} · {p.type}</>}
        actions={
          <button className="btn btn--ghost btn--sm" onClick={() => setRoute('properties')}>
            <Icon name="arrow_left" size={14} /> {t.detail_back}
          </button>
        }
      />
      <div className="content">
        <div className="detail-grid">
          <div>
            <Reveal>
              <div className="gallery">
                <div className="gallery__img gallery__img--main" style={{ backgroundImage: `url(${galleryImgs[0]})` }} />
                <div className="gallery__img" style={{ backgroundImage: `url(${galleryImgs[1]})` }} />
                <div className="gallery__img" style={{ backgroundImage: `url(${galleryImgs[2]})` }} />
                <div className="gallery__img" style={{ backgroundImage: `url(${galleryImgs[3]})` }} />
                <div className="gallery__img" style={{ backgroundImage: `url(${galleryImgs[4]})`, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,27,58,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 14, gap: 6 }}>
                    <Icon name="photo" size={16} /> +{p.photos - 5} fotos
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={1}>
              <div className="detail__title-block">
                <div className="detail__price-line">
                  <div className="detail__price">{p.price}</div>
                  <span className="badge badge--success badge--dot">{t.badge_active}</span>
                  {p.shared && <span className="badge badge--info badge--dot">{t.badge_shared}</span>}
                </div>
                <div className="detail__title">{p.title}</div>
                <div className="detail__loc"><Icon name="location" size={14} />{p.loc}</div>
              </div>
            </Reveal>

            <Reveal delay={2}>
              <div className="detail__specs-row">
                <div className="detail-spec">
                  <div className="detail-spec__icon"><Icon name="bed" size={20} /></div>
                  <div>
                    <div className="detail-spec__label">{t.detail_specs_label_beds}</div>
                    <div className="detail-spec__value">{p.beds}</div>
                  </div>
                </div>
                <div className="detail-spec">
                  <div className="detail-spec__icon"><Icon name="bath" size={20} /></div>
                  <div>
                    <div className="detail-spec__label">{t.detail_specs_label_baths}</div>
                    <div className="detail-spec__value">{p.baths}</div>
                  </div>
                </div>
                <div className="detail-spec">
                  <div className="detail-spec__icon"><Icon name="sqm" size={20} /></div>
                  <div>
                    <div className="detail-spec__label">{t.detail_specs_label_size}</div>
                    <div className="detail-spec__value">{p.sqm} m²</div>
                  </div>
                </div>
                <div className="detail-spec">
                  <div className="detail-spec__icon"><Icon name="car" size={20} /></div>
                  <div>
                    <div className="detail-spec__label">{t.detail_specs_label_parking}</div>
                    <div className="detail-spec__value">2</div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={2}>
              <div className="panel" style={{ marginBottom: 22 }}>
                <div className="panel__head"><div className="panel__title">{t.detail_about}</div></div>
                <p style={{ color: 'var(--ink-700)', fontSize: 14.5, lineHeight: 1.65, margin: 0 }}>{t.detail_about_text}</p>
              </div>
            </Reveal>

            <Reveal delay={3}>
              <div className="panel">
                <div className="panel__head"><div className="panel__title">{t.detail_amenities}</div></div>
                <div className="amenities">
                  {amenities.map((a, i) => (
                    <div key={i} className="amenity">
                      <Icon name="check" size={14} />{a.label}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <div>
            <Reveal>
              <div className="private-card">
                <div className="private-banner">
                  <Icon name="lock" size={14} />
                  {t.private_banner}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 14 }}>{t.private_sub}</div>

                <div className="owner-row">
                  <div className="owner-row__avatar" style={{ backgroundImage: `url(${AVATARS[3]})` }} />
                  <div>
                    <div className="owner-row__name">Eduardo Henríquez</div>
                    <div className="owner-row__role">{t.owner_label} · +1 809 ••• ••42</div>
                  </div>
                  <button className="owner-row__action"><Icon name="phone" size={14} /></button>
                </div>
                <div className="owner-row">
                  <div className="owner-row__avatar" style={{ backgroundImage: `url(${AVATARS[0]})` }} />
                  <div>
                    <div className="owner-row__name">Carolina Méndez</div>
                    <div className="owner-row__role">{t.owner_agent_label} · 12% comisión</div>
                  </div>
                  <button className="owner-row__action"><Icon name="phone" size={14} /></button>
                </div>
              </div>
            </Reveal>

            <Reveal delay={1}>
              <div className="share-card">
                <div className="share-card__title">{t.share_title}</div>
                <div className="share-card__sub">{t.share_sub}</div>

                <div className="share-toggle">
                  <div style={{ flex: 1 }}>
                    <div className="share-toggle__label">Mostrar fotos</div>
                    <div className="share-toggle__sub">Galería completa</div>
                  </div>
                  <div className={'toggle-switch' + (shareSettings.photos ? ' is-on' : '')} onClick={() => toggle('photos')} />
                </div>
                <div className="share-toggle">
                  <div style={{ flex: 1 }}>
                    <div className="share-toggle__label">Ubicación exacta</div>
                    <div className="share-toggle__sub">Mostrar en mapa</div>
                  </div>
                  <div className={'toggle-switch' + (shareSettings.location ? ' is-on' : '')} onClick={() => toggle('location')} />
                </div>
                <div className="share-toggle">
                  <div style={{ flex: 1 }}>
                    <div className="share-toggle__label">Datos del propietario</div>
                    <div className="share-toggle__sub">Privado · Sin datos del dueño</div>
                  </div>
                  <div className={'toggle-switch' + (shareSettings.owner ? ' is-on' : '')} onClick={() => toggle('owner')} />
                </div>
                <div className="share-toggle">
                  <div style={{ flex: 1 }}>
                    <div className="share-toggle__label">Precio negociable</div>
                    <div className="share-toggle__sub">Solo visualización</div>
                  </div>
                  <div className={'toggle-switch' + (shareSettings.price ? ' is-on' : '')} onClick={() => toggle('price')} />
                </div>

                <div className="share-actions">
                  <button className="share-action share-action--primary"><Icon name="share" size={14} />{t.share_action_internal}</button>
                  <button className="share-action"><Icon name="send" size={14} />{t.share_action_client}</button>
                  <button className="share-action"><Icon name="brochure" size={14} />{t.share_action_brochure}</button>
                  <button className="share-action"><Icon name="publish" size={14} />{t.share_action_publish}</button>
                  <button className="share-action share-action--whatsapp"><Icon name="whatsapp" size={14} />{t.share_action_whatsapp}</button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );

}
