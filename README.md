# CCNY PMO Dashboard

Internal portfolio view for the City College of New York PMO. It reads a daily snapshot that Power Automate builds from two SharePoint lists. The browser never calls SharePoint or Power Automate.

**Do not connect real list data until sign-in is turned on.** `VITE_AUTH_MODE=none` is for the mock demo only. A production build with `VITE_DATA_SOURCE=http` and `VITE_AUTH_MODE=none` stops on “Sign-in required”.

## Architecture

```
browser  →  Vercel /api  →  Microsoft Graph  →  SharePoint file
                ↑
daily flow  ────┘  (writes snapshot.json; the browser pulls)
```

The flow does not push into the app. Refresh asks `/api/refresh` to start the flow, then polls until a newer snapshot exists.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. The default scenario is the SharePoint-shaped portfolio (`?scenario=portfolio`). `?scenario=tickets` is the earlier ticket snapshot. No credentials are required for the demo.

`npm run dev:api` (`vercel dev`) serves the `/api` routes with the fake Graph client when `REFRESH_MODE=mock`.

| Script                                   | What it does                           |
| ---------------------------------------- | -------------------------------------- |
| `npm run dev`                            | Local screens, mock data               |
| `npm test`                               | Unit and component tests               |
| `npm run test:e2e`                       | Playwright and axe                     |
| `npm run lint` / `npm run typecheck`     | ESLint and `tsc`                       |
| `npm run build`                          | Production bundle                      |
| `npm run schema:export`                  | Regenerate `docs/snapshot.schema.json` |
| `npm run validate:snapshot -- file.json` | Print field-path validation errors     |

`VITE_*` values are baked in at build time. Change one, then redeploy. Server variables (`MS_*`, `SP_*`, `SESSION_SECRET`, `REFRESH_FLOW_URL`) are read only inside `/api`.

The app uses Zod 4. Production `npm audit` is gated at critical. Remaining advisories are in dev-only test tools and are not in the static bundle.

## Modes

`getMode()` in `src/domain/mode.ts`:

- Tickets present, and `meta.mode` is not `portfolio`: ticket screens, same behavior as before.
- No tickets: portfolio mode. Health comes from reported status, updates, risks, and dates. A project with no updates and no reported health is **No data**, never Green.
- `meta.mode` overrides that choice.

## Environments

|            | `VITE_DATA_SOURCE` | `VITE_AUTH_MODE`                   | `REFRESH_MODE`             |
| ---------- | ------------------ | ---------------------------------- | -------------------------- |
| Demo       | `mock`             | `none`                             | unused                     |
| Local API  | `http`             | `none` only if `REFRESH_MODE=mock` | `mock`                     |
| Production | `http`             | `session`                          | `trigger` or `reload-only` |

Switching the real Graph client on is environment variables only. See `docs/HANDOFF.md`.

## Health and the owner filter

Portfolio rules and thresholds live in `RAG_CONFIG` (`src/lib/config.ts`). The Why control lists the rules that fired. A `healthOverride` is labeled as a PMO override and wins.

The header filter is everyone on `snapshot.team`, plus Unassigned. A project is included when that person is the lead, or the author or owner of an open update. In ticket mode the rule is still lead or assignee on an open ticket.

## Refresh

Shift+R, or the header button. After a success the screen checks that `generatedAt` moved. If it did not, the banner says the data did not change. `reload-only` says the latest file was reloaded and names the daily run time. Polling pauses while the tab is hidden.

## Brand

Purple `#7D55C7` and yellow `#F3D03E` are the 2026 CCNY values. The header wordmark is the official one-line white logo, only on the purple field. Fonts are self-hosted Lato and Raleway. This is an internal PMO tool, not a public college site.
