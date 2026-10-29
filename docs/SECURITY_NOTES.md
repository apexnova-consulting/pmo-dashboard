# Security notes

## Data flow

The browser talks only to this site. `/api` uses app-only Microsoft Graph to read three files in one document library: the snapshot, `refresh-status.json`, and the refresh history. In `trigger` mode, `/api/refresh` POSTs the flow URL from the server. The flow URL is never sent to the browser and is not written to logs. Logs record a code and a status or a field path, never an update summary, ticket, or email body.

## Permission to request

One app registration, client credentials, Graph application permission **Sites.Selected**, then a site-level grant that allows read on the PMO site only. Do not grant `Sites.Read.All`. The client secret lives in the Vercel project environment, not in the repo and not in any `VITE_` variable.

Sign-in, when enabled, is delegated OpenID Connect for the user and is separate from the app-only Graph token. The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS. It is HMAC-signed with `SESSION_SECRET`. The ID token is checked for RS256, audience, expiry, and the college tenant id. `ALLOWED_EMAILS` or `ALLOWED_GROUP_IDS` can narrow who gets a session.

## What is stored

Updates can contain names and operational notes. Email rows store a title, a short plain summary, and a link. They do not store the message body. Retention follows the SharePoint library’s policy. This app does not add its own archive.

## What a production deploy must not do

- Ship with `VITE_AUTH_MODE=none` and `VITE_DATA_SOURCE=http`. The client refuses to render.
- Put secrets in `VITE_` names. CI rejects names containing SECRET, TOKEN, PASSWORD, or KEY.
- Log Graph or flow URLs that include a signature.
