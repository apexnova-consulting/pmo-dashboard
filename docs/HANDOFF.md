# Handoff

## Done

- Schema v1 still parses. Schema v2 adds updates, optional Jira URL, optional risk scores, and history that can be RAG counts only.
- Portfolio mode and ticket mode. Portfolio health, KPIs, Updates, project timeline, risks by level, My Projects, and projects per lead.
- `/api/snapshot`, `/api/refresh`, `/api/refresh/:runId`, `/api/refresh/history` against a fake Graph client. The SharePoint client is selected when `REFRESH_MODE` is not `mock` and the Graph env vars are set.
- Entra authorization-code + PKCE session, tenant check, optional allow list. Documented alternatives in `docs/AUTH.md`.
- `docs/snapshot.schema.json`, `npm run validate:snapshot`, SharePoint mapping, security notes.
- Mock scenarios: `portfolio` (default), `tickets`, `empty`, `huge`, `stale`, `error`, `malformed`, `refresh-fail`, `refresh-unchanged`, `refresh-reload`.

## Still mocked

- SharePoint files, when `REFRESH_MODE=mock` (the default). The fake client serves `portfolio.v2` from memory.
- The Power Automate flows, the mailbox parser, and the Microsoft app registration. Those are out of scope.
- Sign-in, when `AUTH_MODE=none`.

## What the organization has to supply

| Name                                   | Purpose                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `MS_TENANT_ID`                         | College tenant. Also the token tenant check                                               |
| `MS_CLIENT_ID` / `MS_CLIENT_SECRET`    | App-only Graph, and the OIDC client                                                       |
| `SP_SITE_ID` / `SP_DRIVE_ID`           | The one PMO site and library                                                              |
| `SP_SNAPSHOT_PATH`                     | Snapshot JSON path in that library                                                        |
| `SP_STATUS_PATH`                       | `refresh-status.json`                                                                     |
| `SP_HISTORY_PATH`                      | Refresh history JSON                                                                      |
| `REFRESH_FLOW_URL`                     | HTTP trigger, server-side only. Empty when IT blocks the trigger                          |
| `REFRESH_MODE`                         | `trigger`, `reload-only`, or `mock`                                                       |
| `REFRESH_ROLES`                        | Group ids, role names, or emails allowed to press Refresh. Empty means any signed-in user |
| `AUTH_MODE`                            | `session` before real data                                                                |
| `SESSION_SECRET`                       | Cookie signing key                                                                        |
| `AUTH_REDIRECT_URI`                    | `https://<host>/api/auth/callback`                                                        |
| `ALLOWED_GROUP_IDS` / `ALLOWED_EMAILS` | Optional                                                                                  |
| `VITE_DATA_SOURCE`                     | `http` in production. Re-deploy after changing it                                         |
| `VITE_AUTH_MODE`                       | `session` in production                                                                   |

## Go-live checklist

- [ ] App registration exists and `Sites.Selected` is granted on the PMO site only.
- [ ] Lists match `docs/SHAREPOINT_MAPPING.md`. A sample file passes `npm run validate:snapshot`.
- [ ] The daily flow writes the snapshot, the status file, and appends history.
- [ ] IT has said whether the HTTP trigger is allowed. If not, set `REFRESH_MODE=reload-only`.
- [ ] Sign-in choice is recorded. If it is not the Entra routes in this repo, `currentUser` is updated and `docs/AUTH.md` notes the decision.
- [ ] Vercel env vars are set. No secret uses a `VITE_` name.
- [ ] `VITE_DATA_SOURCE=http` and `VITE_AUTH_MODE=session`, then a new production deploy.
- [ ] An unsigned browser receives 401. A signed-in user outside `REFRESH_ROLES` receives 403 on refresh.
- [ ] A bad snapshot returns 502 and the previous good snapshot stays on screen.

## Decisions left open

- Auth provider: Entra routes are the default. Vercel Authentication or the campus gateway are alternatives.
- Whether the HTTP trigger is allowed: `trigger` versus `reload-only`.
- Where history is stored: a JSON file in the library is the default. A list would be a flow change, not a UI change, as long as `GET /api/refresh/history` still returns `RefreshRun[]`.
