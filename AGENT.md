# htmlteam Agent Instructions

Use the fastest primitive first. For deployment, call `POST /api/v1/publish` or
use `htmlteam deploy`, which is only a thin wrapper around that endpoint.

## CLI Rules

- Use `htmlteam --help` to inspect commands.
- Use `--json` for every command when automating.
- Use `HTMLTEAM_ENDPOINT` and `HTMLTEAM_API_KEY` in non-interactive environments.
- Auth is a request-entry concern only; do not add extra setup to the deploy hot path.
- Do not scrape the web UI; it is only a discovery page.

## Deploy

```bash
htmlteam deploy ./index.html --site my-app --message "update" --json
```

For generated content:

```bash
cat index.html | htmlteam deploy --stdin --filename index.html --json
```

Direct API:

```bash
curl -X POST "$HTMLTEAM_ENDPOINT/api/deploy" \
  -H "Authorization: Bearer $HTMLTEAM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"my-app","filename":"index.html","content":"<!doctype html><html><body>Hello</body></html>"}'
```

## Update

```bash
htmlteam deploy ./index.html --site my-app --message "next version" --json
```

## Disable or Delete

```bash
htmlteam site visibility <id-or-slug> private --json
htmlteam delete <id-or-code> --yes --json
```

## Error Handling

All API and CLI JSON responses use:

```json
{
  "success": false,
  "requestId": "...",
  "errorCode": "...",
  "error": "...",
  "detail": "..."
}
```

Retry only transient server or network failures. Do not retry validation failures without changing input.
