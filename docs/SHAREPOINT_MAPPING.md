# SharePoint lists to snapshot fields

The flow reads two lists and writes one JSON file. Choice values must already be the snapshot enums. The UI does not translate “On Hold” or “Green”.

Calendar dates are `YYYY-MM-DD` in `America/New_York`. SharePoint date columns are UTC instants. Convert them to the New York calendar day before writing. Do not send `2026-10-27T00:00:00Z` for a meeting that was on October 28 in New York. Datetimes (`generatedAt`, refresh times) keep a numeric offset.

Person columns become `team[]` entries. `id` is a stable slug of the mail nickname (the part before `@`), lowercased. The same slug is `leadId`, `authorId`, and `ownerId`. Display names are copied onto the update as `authorName` so a removed person still reads clearly.

## Projects list

| Column                            | SharePoint type                                            | Snapshot                                                                |
| --------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Title                             | Text                                                       | `projects[].name`                                                       |
| ProjectKey                        | Text, unique                                               | `projects[].key`                                                        |
| Lead                              | Person                                                     | `projects[].leadId` and `team[]`                                        |
| Phase                             | Choice: Intake, Planning, Active, On hold, Closed, Closing | `phase`: `intake`, `planning`, `active`, `on_hold`, `closing`, `closed` |
| ReportedHealth                    | Choice: Green, Amber, Red                                  | `reportedHealth`: `green`, `amber`, `red`                               |
| HealthNote                        | Plain text                                                 | `healthNote`                                                            |
| PercentComplete                   | Number 0–100                                               | `percentComplete`                                                       |
| StartDate / TargetEndDate         | Date                                                       | `startDate` / `targetEndDate`                                           |
| NextMilestone / NextMilestoneDate | Text / Date                                                | `nextMilestoneName` / `nextMilestoneDate`                               |
| Sponsor, Link                     | Text, URL                                                  | `sponsor`, `url`                                                        |

## Updates / Risks list

| Column        | SharePoint type                               | Snapshot                                       |
| ------------- | --------------------------------------------- | ---------------------------------------------- |
| Title         | Text                                          | `updates[].title`                              |
| Project       | Lookup on ProjectKey                          | `projectKey`                                   |
| UpdateDate    | Date                                          | `date`                                         |
| Author, Owner | Person                                        | `authorId` / `authorName`, `ownerId`           |
| Type          | Choice: Update, Risk, Decision, Action        | `type`: `update`, `risk`, `decision`, `action` |
| Summary       | Plain text                                    | `summary` (max 2000; the API also truncates)   |
| HealthSignal  | Choice: Green, Amber, Red, optional           | `healthSignal` or null                         |
| RiskLevel     | Choice: Low, Medium, High, Critical, optional | `riskLevel` or null                            |
| Blocked       | Yes/No                                        | `blocked`                                      |
| Status        | Choice: Open, Resolved                        | `status`: `open`, `resolved`                   |
| Mitigation    | Plain text                                    | `mitigation`                                   |
| Source        | Choice: List, Email                           | `source`: `list`, `email`                      |
| SourceLink    | URL                                           | `sourceUrl`                                    |

Rows with probability and impact can also be copied to `risks[]` (`probability`, `impact` 1–5, `status` `open|mitigating|closed`). If those numbers are absent, send `riskLevel` only. The heat map hides itself.

## History

Each successful daily run appends one point to the history array stored at `SP_HISTORY_PATH` (or rebuilds the last 12 points into the snapshot’s `history`). Required: `date`, `ragCounts`. Useful: `blockedProjects`, `openRisks`, `byProject`. Ticket counts are optional and should be omitted for this design.

`refresh-status.json` at `SP_STATUS_PATH`:

```json
{ "runId": "", "status": "running", "startedAt": "", "finishedAt": "", "message": "" }
```

The flow writes `running` at the start and `succeeded` or `failed` at the end, using the `runId` the API posted.

## Email subject

The mailbox flow is built outside this repo. It should accept:

`[PROJECTKEY][G|A|R][Update|Risk|Blocked] Short title`

`G`, `A`, and `R` map to `healthSignal` green, amber, and red. `Blocked` sets `blocked: true` and `type` can still be `risk` or `update`. The row’s `source` is `email`. `sourceUrl` is the web link to the message. The body is not copied into the snapshot. The short title is `title`. A one-line plain summary may be taken from the first line of the body, capped at 2000 characters, with no HTML.
