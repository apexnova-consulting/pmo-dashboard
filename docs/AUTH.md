# Sign-in options

Real list data stays disconnected until one of these is in place. The code default is the first option. The college identity team may replace it. The session check is the only function the API routes call (`currentUser` in `api/lib/handlers.ts`), so a different front door can wrap that function.

## 1. Entra ID on these routes (implemented)

`VITE_AUTH_MODE=session` and server `AUTH_MODE=session`.

The browser calls `GET /api/auth/me`. A 401 sends it to `GET /api/auth/login`, which starts the authorization-code flow with PKCE and redirects to `/api/auth/callback`. Logout is `GET /api/auth/logout`.

IT provides:

- Tenant id (`MS_TENANT_ID`). Tokens from any other tenant are rejected.
- App client id and secret. The redirect URI registered in Entra is `https://<host>/api/auth/callback` (`AUTH_REDIRECT_URI`).
- A client secret stored only in Vercel.
- Optional `ALLOWED_GROUP_IDS` or `ALLOWED_EMAILS`.
- `SESSION_SECRET`, a long random string.

Graph app-only access is a second permission on the same registration, or a second app. `Sites.Selected` is documented in `docs/SECURITY_NOTES.md`.

## 2. Vercel Authentication

Vercel can sit in front of the whole deployment. The `/api` routes would trust that network boundary instead of the cookie. Turn this app’s `AUTH_MODE` to match whatever the identity team decides, and keep `currentUser` as the place that decision is enforced. Do not leave both layers in `none`.

## 3. The college gateway

A campus proxy that already authenticates staff can forward a signed header. That header would be read inside `currentUser` and the Entra routes left unused. The proxy team has to name the header and the verification method. This repo does not invent that header.

Until one of these is live, keep `VITE_DATA_SOURCE=mock`.
