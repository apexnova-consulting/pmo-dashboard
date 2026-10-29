# CCNY PMO Dashboard data contract

Schema version: **1**

This is the payload the Copilot / Power Automate job should write, and the shape `GET /api/snapshot` returns. The UI validates it with Zod in `src/data/schema.ts`. Unknown fields are ignored. A breaking change bumps `schemaVersion`.

Dates:

- `YYYY-MM-DD` for calendar dates (`dueDate`, milestone dates, history dates).
- ISO datetimes with a numeric offset, for example `2026-10-28T06:00:00-04:00`.

The dashboard computes every KPI from `generatedAt` in `meta.timezone` (default `America/New_York`), not from the viewer's clock.

## Snapshot

| Field               | Required | Notes                                                                       |
| ------------------- | -------- | --------------------------------------------------------------------------- |
| `schemaVersion`     | yes      | Must be `1`                                                                 |
| `generatedAt`       | yes      | When the automation finished                                                |
| `meta.jiraBaseUrl`  | yes      | Used to build `/browse/KEY` links                                           |
| `meta.timezone`     | no       | Defaults to `America/New_York`                                              |
| `meta.capacityUnit` | no       | Label for `team[].weeklyCapacity`, such as `open tickets`                   |
| `meta.source`       | no       | Free text, such as `copilot-automation v1.2`                                |
| `team`              | yes      | PMO members. The owner filter is built from this list                       |
| `projects`          | yes      |                                                                             |
| `tickets`           | yes      |                                                                             |
| `milestones`        | no       | Defaults to `[]`. Hidden when empty                                         |
| `risks`             | no       | Defaults to `[]`. The register is hidden when empty                         |
| `history`           | no       | Defaults to `[]`. One point per week is enough; 12 or more powers the trend |

### Team member

`id` (stable slug), `displayName`, optional `jiraAccountId`, `email`, `role`, `avatarColor`, `weeklyCapacity`.

Do not invent capacity in the UI. Omit `weeklyCapacity` when Jira does not have it.

### Project

`key`, `name`, `leadId` (`team.id` or `null`), `phase` (`intake | planning | active | on_hold | closing | closed`), optional `startDate`, `targetEndDate`, `healthOverride` (`red | amber | green` or null), `healthNote`, `sponsor`, `url`.

`healthOverride` wins over the calculated health and is labeled as a PMO override.

### Ticket

`key`, `summary`, `type`, `projectKey`, `statusName`, `statusCategory` (`todo | in_progress | done`), `priority` (`highest | high | medium | low | lowest`), `assigneeId` (team id or `null`), `assigneeName`, optional `reporterName`, `created`, `updated`, `dueDate` (date or `null`), `resolvedAt` (datetime or `null`), `labels` (default `[]`), `flagged` (default `false`), optional `storyPoints`, `parentKey`, `sprint`, `url`.

Blocked means `flagged`, a `blocked` label, or a status in `VITE_BLOCKED_STATUSES` (default `Blocked`, `On Hold`, `Waiting`).

### Milestone

`id`, `name`, `projectKey`, `plannedDate`, `forecastDate` (or `null`), `completedDate` (or `null`).

Schedule variance is `forecastDate - plannedDate` in calendar days for milestones that are not complete.

### Risk

`id`, `title`, `projectKey`, `probability` (1–5), `impact` (1–5), `ownerId`, optional `mitigation`, `status` (`open | mitigating | closed`).

### History point

`date`, `open`, `overdue`, `blocked`, `created`, `resolved`, `ragCounts` (`red`, `amber`, `green`), optional `byProject` map of project key to `red | amber | green`.

`byProject` lets an owner filter rebuild the health trend. Without it, the filtered trend can only count projects that exist on that point.

## HTTP API

The browser calls the same origin. A server-side proxy holds the flow URL and any secret.

| Method | Path                            | Response                                                                           |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------- |
| `GET`  | `/api/snapshot`                 | Snapshot. Honor `If-None-Match` with `304`                                         |
| `POST` | `/api/refresh`                  | `202 { runId, startedAt }`. `409 { runId, startedAt }` when a run is already going |
| `GET`  | `/api/refresh/:runId`           | `{ runId, status, startedAt, finishedAt?, message?, progress? }`                   |
| `GET`  | `/api/refresh/history?limit=10` | `RefreshRun[]`                                                                     |

`status` is `queued | running | succeeded | failed`. `progress` is `0`–`1`.

Errors:

```json
{ "error": { "code": "STRING", "message": "Human readable, with no ticket text" } }
```

`401` means the user must sign in. The UI keeps the last valid snapshot on screen when a later payload fails validation.

## Assigned work

A project is in a person's view when they are `leadId`, or they are the assignee on at least one open ticket. The projects table marks that as Lead or Contributor. Unassigned covers a null lead or an open ticket with a null assignee.

## Size

A few thousand tickets in one gzip JSON is fine. Above about 5 MB, split ticket paging behind `DataClient` so the UI components do not change.
