const commands = [
  'npm run cli -- auth login --endpoint https://your-domain.com --token $HTMLTEAM_API_KEY',
  'npm run cli -- deploy ./index.html --site launch-page --message "v1" --json',
  'npm run cli -- site list --json',
  'npm run cli -- versions launch-page --json',
  'npm run cli -- rollback launch-page --to 1 --json',
];

const apiExample = `curl -X POST https://your-domain.com/api/v1/publish \\
  -H "Authorization: Bearer $HTMLTEAM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "agent-page",
    "filename": "index.html",
    "title": "agent-page",
    "message": "first version",
    "content": "<!doctype html><html><body>Hello Agent</body></html>"
  }'`;

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <div className="mb-10 inline-flex w-fit rounded-full border border-[var(--line)] bg-white px-3 py-1 text-sm font-semibold text-[var(--accent)]">
          Agent-native HTML deploy runtime
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-[var(--ink)] sm:text-7xl">
              htmlteam is a CLI first deploy backend.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              The browser UI is intentionally small. Agents and humans publish immutable HTML
              versions through a stable CLI and JSON API, then share the current or pinned route.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/.well-known/htmlteam-cli.json"
                className="rounded-md bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white"
              >
                CLI manifest
              </a>
              <a
                href="/llms.txt"
                className="rounded-md border border-[var(--line)] bg-white px-4 py-3 text-sm font-bold text-[var(--ink)]"
              >
                Agent guide
              </a>
              <a
                href="/api/v1/health"
                className="rounded-md border border-[var(--line)] bg-white px-4 py-3 text-sm font-bold text-[var(--ink)]"
              >
                Health check
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
              Native CLI flow
            </p>
            <div className="space-y-3">
              {commands.map((command) => (
                <pre key={command} className="overflow-auto rounded-md bg-[#111827] p-3 text-sm text-white">
                  {command}
                </pre>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            Direct API
          </p>
          <pre className="overflow-auto rounded-md bg-[#111827] p-4 text-sm leading-6 text-white">
            {apiExample}
          </pre>
        </div>
      </section>
    </main>
  );
}
