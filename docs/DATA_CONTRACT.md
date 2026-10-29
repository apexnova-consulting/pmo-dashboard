# CCNY PMO Dashboard data contract

Schema versions **1** and **2** both parse. Unknown fields are ignored. A breaking change bumps `schemaVersion`. The Zod source is `src/data/schema.ts`. `docs/snapshot.schema.json` is generated from it for a Power Automate Parse JSON step.

Dates:

- `YYYY-MM-DD` for calendar dates. Send the America/New_York calendar day, not a UTC instant shifted to the previous evening.
- ISO datetimes with a numeric offset, for example `2026-10-28T06:00:00-04:00`.

Every KPI uses `generatedAt` in `meta.timezone` (default `America/New_York`), not the viewer's clock.

## Mode

`meta.mode` may be `tickets` or `portfolio`. When it is omitted, any ticket selects ticket mode and an empty ticket list selects portfolio mode.

Ticket mode keeps the v1 screens. Portfolio mode ignores ticket KPIs and uses projects, updates, risks, and milestones.

## Snapshot

| Field                   | Required | Notes                                                                                     |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `schemaVersion`         | yes      | `1` or `2`                                                                                |
| `generatedAt`           | yes      | When the flow finished                                                                    |
| `meta.jiraBaseUrl`      | no       | Ticket links render only when this or `tickets[].url` is set. Portfolio snapshots omit it |
| `meta.timezone`         | no       | Default `America/New_York`                                                                |
| `meta.mode`             | no       | `tickets` or `portfolio`                                                                  |
| `meta.nextScheduledRun` | no       | Shown next to the data-as-of line                                                         |
| `meta.source`           | no       | Free text, such as `sharepoint lists`                                                     |
| `team`                  | yes      | People for the owner filter. `id` is a stable slug                                        |
| `projects`              | yes      | `key` is required and unique                                                              |
| `tickets`               | no       | Defaults to `[]`. Do not send a ticket list for the SharePoint design                     |
| `updates`               | no       | Defaults to `[]`. Core of schema v2                                                       |
| `milestones`            | no       | Defaults to `[]`                                                                          |
| `risks`                 | no       | Defaults to `[]`                                                                          |
| `history`               | no       | Defaults to `[]`. `ragCounts` is required on each point                                   |

### Project fields added in v2

All optional: `reportedHealth` (`red|amber|green`, the lead’s own call; distinct from `healthOverride`), `percentComplete` (0–100), `nextMilestoneName`, `nextMilestoneDate`, `lastUpdateDate`, `notes`.

`healthOverride` still wins and is labeled as a PMO override.

### Update

`id`, `projectKey`, `date`, `type` (`update|risk|decision|action`), `title`, `summary` (plain text, at most 2000 characters; the API truncates before validation), `authorId`, `authorName`, `healthSignal`, `riskLevel` (`low|medium|high|critical` or null), `blocked`, `status` (`open|resolved`), `ownerId`, optional `mitigation`, `source` (`list|email`), optional `sourceUrl`.

`sourceUrl` is a web link to the list item or the message. It is never the email body. The UI renders `summary` as plain text.

### Risk

`probability` and `impact` (1–5) are optional. `riskLevel` is optional. The heat map renders only when both numbers exist. Otherwise the risks page sorts by level.

### History point

`ragCounts` (`red`, `amber`, `green`) is required. `open`, `overdue`, `blocked`, `created`, and `resolved` are optional so a portfolio history can omit ticket counts. Optional `blockedProjects`, `openRisks`, and `byProject` (project key to `red|amber|green`). The trend chart uses `ragCounts` alone. `byProject` lets an owner filter rebuild the trend.

### v1

A v1 payload with `meta.jiraBaseUrl`, required history counts, and tickets still parses. New clients should send v2.

## HTTP API

Same origin. The server holds the Graph credentials and the flow URL.

| Method | Path                            | Response                                                                                                                                     |
| ------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/snapshot`                 | Snapshot. `ETag` from Graph. `If-None-Match` returns `304`. `Cache-Control: private, no-store`                                               |
| `POST` | `/api/refresh`                  | `202 { runId, startedAt }`. `409 { runId, startedAt }` when a run is already going. `403` when the signed-in user is outside `REFRESH_ROLES` |
| `GET`  | `/api/refresh/:runId`           | `{ runId, status, startedAt, finishedAt?, message?, progress? }`                                                                             |
| `GET`  | `/api/refresh/history?limit=10` | `RefreshRun[]`                                                                                                                               |

`status` is `queued | running | succeeded | failed`.

`REFRESH_MODE=trigger` calls `REFRESH_FLOW_URL` from the server. `reload-only` completes immediately with “Reloaded the latest data…”. `mock` uses the in-memory files.

A run is `succeeded` when the status file says so, or when `generatedAt` is newer than `startedAt`. It is `failed` after `REFRESH_TIMEOUT_MS` (default 10 minutes).

Errors:

```json
{ "error": { "code": "STRING", "message": "Human readable, with no update or email text" } }
```

`401` means the caller is not signed in. `502` with code `BAD_SNAPSHOT` means the file failed validation. The message does not include the file contents. The UI keeps the last valid snapshot on screen.

## Assigned work

Portfolio: a project is in a person’s view when they are `leadId`, or `authorId` or `ownerId` on an open update. Unassigned covers a null lead or an open update with a null author or owner.

Tickets: a project is in a person’s view when they are the lead, or the assignee on an open ticket.
