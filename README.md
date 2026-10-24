# HTMLCode.fun

HTMLCode.fun is a Next.js app for publishing standalone HTML pages to a shareable URL. It supports manual uploads from the browser and structured API uploads from agents, then stores HTML files, metadata, versions, likes, and QR-code assets in Supabase.

Production: https://htmlcode.fun

## What It Does

- Publish HTML by uploading a file, pasting source, or calling the API.
- Generate short links such as `/s/my-page` plus version links like `/s/my-page/v/2`.
- Store page files in Supabase Storage and deployment metadata in Postgres.
- Keep version history, switch the current version, or choose the latest-active-version strategy.
- Lock liked projects and versions from destructive edits.
- Track views, likes, file size, status, and project descriptions.
- Provide API-friendly JSON errors for agent retries.
- Expose a password-protected CORS toggle for API/demo workflows.

## Tech Stack

- Next.js App Router
- React
- Supabase Postgres + Storage
- Vercel
- Tailwind CSS

## Environment Variables

Use Vercel as the source of truth, then pull values into `.env.local`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CORS_TOGGLE_PASSWORD=
HTML_SERVE_VIA=
HTML_API_VIA=
```

Leave `HTML_SERVE_VIA` empty until `serve-deployment-html` is deployed. Set it to `edge` to serve version HTML from that function. Leave `HTML_API_VIA` empty to send publish and content-read bodies to Supabase. Set it to `vercel` to keep those routes on this app.

Pull production variables locally:

```bash
npm run vercel:env:pull
```

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## HTML Delivery

Public pages stay on `/s/:code`. That route resolves the primary version and redirects once to `/s/:code/v/:version?rev=<object>`. A real visit still increments the view count. Marketplace cards load `/s/:code?preview=1`, which redirects to the same revision URL without counting a view, and that redirect is cached at the CDN for five minutes. Detail previews of an active version end on that same URL. Inactive previews stay uncached.

`rev` is the storage object name. Overwriting a version creates a new object, so a matching `rev` is safe to cache as immutable HTML (`s-maxage=31536000`). A CDN miss is the only time that file passes through a Vercel function.

`HTML_SERVE_VIA` controls where those bytes come from:

- Unset or any value other than `edge`: this app responds with `text/html; charset=utf-8` and the long CDN lifetime above.
- `edge`: a matching `rev` redirects to the Supabase Edge Function `serve-deployment-html`. The redirect itself is cached for one hour. The browser then loads the HTML from Supabase, so the file does not count as Vercel Fast Origin Transfer. The address bar ends on that function URL. Deploy the function before setting this:

```bash
npx supabase functions deploy serve-deployment-html --no-verify-jwt
```

Then set `HTML_SERVE_VIA=edge` in Vercel and redeploy the app. Leave the variable unset to keep serving HTML from this app.

The function answers only for a deployment version that exists. Inactive deployments and versions are rejected unless `preview=1` is present. Its response `Content-Type` is `text/html; charset=utf-8`. CORS headers are added only while the CORS admin toggle is on.

Do not point browsers at the Storage object URL. Supabase Storage rewrites any object whose type contains `text/html` to `text/plain` and sends `Content-Security-Policy: default-src 'none'; sandbox`. The `deployments` bucket stays public so uploads, QR codes, and the service-role download keep working.

`vercel.json` sets `skipMiddlewareRequestBody`. Middleware does not read request bodies. HTML publish still accepts `application/json` on `POST /api/deploy`, `PATCH /api/deploy/content`, and version overwrite. Other content types, and any write to `/s/*`, are refused before the body is forwarded to a function. `public/robots.txt` keeps `/s/` crawlable and disallows `/api/`, `/deploy`, and `preview=1`.

Published pages stay on `htmlcode.fun`. Version HTML is immutable at the CDN (`s-maxage=31536000`), so a repeat view does not transfer the file through a function. The document origin stays on this site because published pages use `localStorage` and expect that host.

Large publish and content-read bodies take a different path. When `NEXT_PUBLIC_SUPABASE_URL` is set and `HTML_API_VIA` is not `vercel`, middleware answers `POST /api/deploy`, `PATCH /api/deploy/content`, `PATCH /api/deploys/:code/versions/:version`, and `GET /api/deploy/content` with `307` to the Supabase Edge Function `html-api` before a Vercel function starts. Clients that follow `307` (browsers, `fetch`, and typical agent HTTP libraries) resend the JSON there, so the HTML is not Fast Origin Transfer. Responses keep the same JSON shape, and links inside them still use the htmlcode.fun origin. Set `HTML_API_VIA=vercel` and redeploy to run those routes on Vercel again.

Deploy the function before relying on the redirect:

```bash
npx supabase functions deploy html-api --no-verify-jwt
```

## Database And Storage

Supabase migrations live in `supabase/migrations`.

They cover the deployment tables, version tables, like counters, app settings, RPC helpers, and storage policies used by the app.

Sync local migrations to the linked Supabase project:

```bash
npm run supabase:db:push
```

Useful Supabase commands:

```bash
npm run supabase:login
npm run supabase:link
npm run supabase:db:push
```

## Deployment

The project is linked to Vercel. Normal production deployment flow:

```bash
npm run lint
npm run build
git push origin master
```

Vercel deploys `master` to production. You can also deploy directly:

```bash
npx vercel deploy --prod --yes
```

## API Notes

Main upload endpoint:

```http
POST /api/deploy
Content-Type: application/json
```

Typical payload:

```json
{
  "filename": "index.html",
  "content": "<!doctype html><html>...</html>",
  "description": "A short project description",
  "enableCustomCode": true,
  "customCode": "my-page"
}
```

Other useful endpoints include:

- `GET /api/deploys`
- `GET /api/deploy/content?code=my-page`
- `PATCH /api/deploy/content`
- `GET /api/deploys/:code/versions`
- `PATCH /api/deploys/:code/current`
- `PATCH /api/deploys/:code/primary-strategy`

See `/api-docs` in the running app for agent-oriented guidance.
New short-link responses also include `agentGuideUrl`
(`https://www.htmlcode.fun/s/htmlcode-fun-guide`) so agents can pass along a
stable guide for using htmlcode.fun.
Daily cleanup removes single-version deployments that have neither a manual like
nor an appended version.

## Common Commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run smoke:prod
npm run vercel:link
npm run vercel:env:pull
npm run supabase:db:push
```
