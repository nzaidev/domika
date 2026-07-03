'use client';

import { useEffect, useState } from "react";
import { I18N } from "@/lib/i18n";
import type { Lang, Property, Route } from "@/lib/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import {
  TweaksPanel,
  TweakRadio,
  TweakSection,
  useTweaks,
} from "@/components/tweaks/TweaksPanel";
import { Landing } from "@/components/views/Landing";
import { Dashboard } from "@/components/views/Dashboard";
import { Crm } from "@/components/views/Crm";
import { Properties } from "@/components/views/Properties";
import { Detail } from "@/components/views/Detail";

const TWEAK_DEFAULTS = { lang: "es" as Lang };

export default function PropFlowApp() {
  const [route, setRoute] = useState<Route>("landing");
  const [property, setProperty] = useState<Property | null>(null);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const t = I18N[tweaks.lang as Lang] || I18N.es;

  const openProperty = (p: Property) => {
    setProperty(p);
    setRoute("detail");
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const isLanding = route === "landing";

  return (
    <>
      <div className={"app" + (isLanding ? " app--landing" : "")}>
        {!isLanding && <Sidebar active={route} setRoute={setRoute} t={t} />}
        <main className="main">
          {route === "landing" && <Landing t={t} setRoute={setRoute} />}
          {route === "dashboard" && (
            <Dashboard t={t} setRoute={setRoute} openProperty={openProperty} />
          )}
          {route === "leads" && <Crm t={t} />}
          {route === "properties" && (
            <Properties t={t} openProperty={openProperty} />
          )}
          {route === "detail" && (
            <Detail t={t} property={property} setRoute={setRoute} />
          )}
          {(route === "tasks" ||
            route === "network" ||
            route === "brochures" ||
            route === "settings") && (
            <div className="page">
              <Topbar
                title={t[`nav_${route}`] || route}
                subtitle="Próximamente"
              />
              <div className="content">
                <div
                  className="panel"
                  style={{ textAlign: "center", padding: 80 }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      fontWeight: 700,
                    }}
                  >
                    Sección en construcción
                  </div>
                  <div style={{ color: "var(--ink-500)", marginTop: 8 }}>
                    Esta vista forma parte del roadmap del MVP.
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Idioma">
          <TweakRadio
            label="Language"
            value={tweaks.lang}
            onChange={(v: string) => setTweak("lang", v)}
            options={[
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}
