# CCNY PMO Dashboard

Internal portfolio view for the City College of New York PMO. It reads a daily Jira snapshot. It does not write back to Jira.

The screen is ready to demo on mock data. Pointing `VITE_DATA_SOURCE` at `http` is the only application change required when the automation proxy exists.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173.

| Script              | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Local app                       |
| `npm test`          | Unit and component tests        |
| `npm run test:e2e`  | Playwright smoke and axe checks |
| `npm run lint`      | ESLint, including jsx-a11y      |
| `npm run typecheck` | `tsc --noEmit`                  |
| `npm run build`     | Typecheck and production bundle |

## Environments

|                | `VITE_DATA_SOURCE` | Notes                                          |
| -------------- | ------------------ | ---------------------------------------------- |
| Dev / demo     | `mock`             | Seeded City College portfolio. No network      |
| Staging / prod | `http`             | Same-origin `/api/snapshot` and `/api/refresh` |

Mock scenarios, from Data & Status or `?scenario=`: `normal`, `empty`, `huge`, `stale`, `error`, `malformed`, `refresh-fail`.

## What the header filter means

All, each person on `snapshot.team`, and Unassigned. Several can be selected. The choice is stored in `?owner=` and remembered in the browser.

A project is included when that person is the lead, or is assigned to at least one open ticket. The projects table says Lead or Contributor. Adding a fourth person is a data change only.

## Health

Red if any red rule is true, otherwise amber, otherwise green. Thresholds live in `src/lib/config.ts` (`RAG_CONFIG`). A project's `healthOverride` wins and is labeled as a PMO override. Each project has a Why control that lists the rules that fired.

Blocked statuses, stale days, and the missed-run banner are environment variables. See `.env.example`.

## Refresh

The Refresh button calls `POST /api/refresh`, then polls. In mock mode the run lasts about eight seconds, can fail (`?scenario=refresh-fail`), and attaches if one is already running. Shift+R starts it, except while typing in a field. There is a 60 second cooldown after a success.

The browser must not call Power Automate directly. The proxy holds the flow URL.

## Auth

`VITE_AUTH_MODE=none` for the demo. `static` expects Azure Static Web Apps (`/.auth/me`, redirect to `/.auth/login/aad`). College SSO should sit in front of production either way. Unauthenticated API calls should return 401.

## Brand

Purple `#7D55C7` and yellow `#F3D03E` are the 2026 CCNY style-guide values (PMS 2665 C and PMS 129 C). The header wordmark is the official one-line white logo from the college's public logo package, shown only on the purple field and not recolored. Fonts are self-hosted Lato and Raleway, the brand sans and display faces, with Verdana as the fallback. This is an internal PMO tool, not a public college site.

## Add a KPI

Add a pure function under `src/domain`, a definition in `METRICS`, and one entry rendered by `KpiCard`. Do not invent a number the snapshot does not contain.

## Known dependency note

`npm audit` reports a high advisory in Zod 3 that is fixed in Zod 4. The JSON contract in `docs/DATA_CONTRACT.md` is unchanged. Production audit in CI gates on critical issues. Dev-only Vitest advisories are not shipped in the static bundle.
