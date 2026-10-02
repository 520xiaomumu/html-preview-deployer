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
```

Leave `HTML_SERVE_VIA` empty until `serve-deployment-html` is deployed. Set it to `edge` to serve version HTML from that function.

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

Public pages stay on `/s/:code`. That route resolves the primary version (likes, then current, then latest), records the view without waiting on the database, and redirects once to `/s/:code/v/:version?rev=<object>`.

When `rev` already matches the stored object, the version route does not send another `no-store` redirect. Marketplace and admin previews of an active version are sent to that same `/s/:code/v/:version?rev=` URL, so they share its cache instead of downloading the file on every view. `GET /api/deploys` is cached at the CDN for 30 seconds.

`HTML_SERVE_VIA` controls where those bytes come from:

- Unset or any value other than `edge`: this app responds with `text/html; charset=utf-8` and a long CDN lifetime. A CDN miss is the only time the file passes through a Vercel function.
- `edge`: a matching `rev` redirects to the Supabase Edge Function `serve-deployment-html`. The redirect itself can be cached; the browser then loads the HTML from Supabase, so the file does not count as Vercel Fast Origin Transfer. The address bar ends on that function URL. Deploy the function before setting this:

```bash
npx supabase functions deploy serve-deployment-html --no-verify-jwt
```

Then set `HTML_SERVE_VIA=edge` in Vercel and redeploy the app.

The function answers only for a deployment version that exists. Inactive deployments and versions are rejected unless `preview=1` is present, which is the same preview gate the app already uses. Its response `Content-Type` is `text/html; charset=utf-8`. CORS headers are added only while the CORS admin toggle is on.

Do not point browsers at the Storage object URL. The `deployments` bucket stays public so uploads, QR codes, and the service-role download keep working, but Supabase Storage rewrites any object whose type contains `text/html` to `text/plain` and the public response also sends `Content-Security-Policy: default-src 'none'; sandbox`. Signed Storage URLs use that same renderer, so they do not restore a rendered page. No extra Storage policy is required for the edge function.

## Database And Storage

Supabase migrations live in `supabase/migrations`.

They cover the deployment tables, version tables, like counters, app settings, RPC helpers, and storage policies used by the app. The `deployments` bucket remains public, with public read access, as created by the initial migration.

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
