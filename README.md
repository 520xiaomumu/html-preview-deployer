# htmlteam

Agent-native HTML deployment backend. The deploy hot path is a single JSON request
that finds or creates a site, stores an immutable version, and moves the current
version pointer.

## Model

- Deploy complete HTML documents.
- Store HTML inline for the fastest path.
- Model long-lived sites with immutable versions.
- Serve public pages through `/s/:slug` and pinned versions through `/s/:slug@v3`.
- Manage sites through `/api/v1` or the native `htmlteam` CLI.
- Use stable JSON envelopes for agent automation.

## Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
HTMLTEAM_API_KEY=
```

`HTMLTEAM_API_KEY` is required in production. In local development, the API allows a `local-dev` actor if the key is absent.

## Local Development

```bash
npm install
npm run dev
```

Apply database migrations:

```bash
npm run supabase:db:push
```

## CLI

Run locally through npm:

```bash
npm run cli -- --help
npm run cli -- auth login --endpoint http://localhost:3000 --token "$HTMLTEAM_API_KEY"
npm run cli -- deploy ./index.html --site demo-page --message "v1" --json
npm run cli -- site list --json
npm run cli -- versions demo-page --json
```

When published as a package, the executable name is:

```bash
htmlteam
```

## API

Fast site publish:

```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $HTMLTEAM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "demo-page",
    "filename": "index.html",
    "title": "demo",
    "message": "v1",
    "content": "<!doctype html><html><body><h1>Hello</h1></body></html>"
  }'
```

Read public page:

```bash
curl http://localhost:3000/s/demo-page
curl http://localhost:3000/s/demo-page@v1
```

## Agent Discovery

- `/.well-known/htmlteam-cli.json`
- `/llms.txt`
- `AGENT.md`

## Important Security Notes

The storage bucket is private by design. Do not make the bucket public; public access should go through `/s/:code` so inactive and private deployments cannot be bypassed.
