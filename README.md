# Domika (PropFlow)

Next.js app for **PropFlow** — a smart real estate platform prototype (CRM, property inventory, landing page, and more).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
├── app/                    # Next.js App Router (layout, page, globals.css)
├── components/
│   ├── PropFlowApp.tsx     # Main client app shell + routing
│   ├── layout/             # Sidebar, Topbar
│   ├── ui/                 # Icon, Reveal, Counter
│   ├── tweaks/             # Dev preview panel (language toggle)
│   └── views/              # Landing, Dashboard, CRM, Properties, Detail
└── lib/
    ├── data.ts             # Mock properties, leads, photos
    ├── i18n.ts             # Spanish / English copy
    └── types.ts            # Shared TypeScript types
public/
└── uploads/                # Static images
legacy/
└── index.html              # Original single-file prototype
```

## Notes

- The UI was migrated from a static HTML + Babel standalone prototype in `legacy/index.html`.
- Routing is currently client-side state inside `PropFlowApp`. Next step is to split views into App Router routes (e.g. `/dashboard`, `/properties/[id]`).
- Mock data lives in `src/lib/data.ts` until a backend is connected.
