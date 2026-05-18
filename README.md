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
```

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
New deployments that receive neither a manual like nor an appended version within
24 hours are eligible for automatic cleanup.

## Common Commands

```bash
npm run dev
npm run lint
npm run build
npm run smoke:prod
npm run vercel:link
npm run vercel:env:pull
npm run supabase:db:push
```
