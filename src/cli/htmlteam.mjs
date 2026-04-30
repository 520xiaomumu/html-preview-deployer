#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const DEFAULT_ENDPOINT = 'http://localhost:3000';
const CONFIG_DIR = path.join(os.homedir(), '.htmlteam');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function printHelp() {
  console.log(`htmlteam - Agent-native HTML deployment CLI

Usage:
  htmlteam auth login --endpoint <url> --token <api-key>
  htmlteam auth status [--json]
  htmlteam auth logout
  htmlteam deploy <file> [--site <slug>] [--title <title>] [--message <message>] [--visibility public|private|unlisted] [--json]
  htmlteam deploy --stdin --filename <name.html> [--site <slug>] [--title <title>] [--json]
  htmlteam list [--visibility public|unlisted|private] [--json]
  htmlteam get <id-or-code> [--json]
  htmlteam content <id-or-code> [--output <file>] [--json]
  htmlteam update <id-or-code> <file> [--title <title>] [--filename <name.html>] [--json]
  htmlteam site list [--json]
  htmlteam site info <id-or-slug> [--json]
  htmlteam site visibility <id-or-slug> <public|unlisted|private> [--json]
  htmlteam versions <id-or-slug> [--json]
  htmlteam rollback <id-or-slug> --to <version> [--json]
  htmlteam agent create <name> [--json]
  htmlteam agent list [--json]
  htmlteam agent revoke <id> [--json]
  htmlteam delete <id-or-code> [--yes] [--json]
  htmlteam open <id-or-code>

Environment:
  HTMLTEAM_ENDPOINT  API endpoint, defaults to saved config or ${DEFAULT_ENDPOINT}
  HTMLTEAM_API_KEY   API token, defaults to saved config
`);
}

function parseArgs(argv) {
  const flags = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }

    const eqIndex = value.indexOf('=');
    if (eqIndex !== -1) {
      flags[value.slice(2, eqIndex)] = value.slice(eqIndex + 1);
      continue;
    }

    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }

  return { flags, positionals };
}

async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeConfig(config) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

async function getRuntime() {
  const config = await readConfig();
  return {
    endpoint: process.env.HTMLTEAM_ENDPOINT || config.endpoint || DEFAULT_ENDPOINT,
    token: process.env.HTMLTEAM_API_KEY || config.token || '',
  };
}

async function request(method, pathname, body, flags = {}) {
  const { endpoint, token } = await getRuntime();
  const headers = {
    Accept: 'application/json',
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${endpoint}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = typeof payload === 'object' && payload !== null ? payload : {
      success: false,
      error: String(payload),
    };
    if (flags.json) {
      console.log(JSON.stringify(error, null, 2));
    } else {
      console.error(`Error: ${error.error || response.statusText}`);
      if (error.detail) console.error(error.detail);
    }
    process.exit(1);
  }

  return payload;
}

function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

async function resolveDeployment(input) {
  if (!input) throw new Error('Missing deployment id or code.');
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
  const payload = looksLikeUuid
    ? await request('GET', `/api/v1/sites/${encodeURIComponent(input)}`)
    : await request('GET', `/api/v1/deployments/by-code/${encodeURIComponent(input)}`);
  return unwrap(payload);
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function printDeployment(item) {
  console.log(`${item.slug || item.code}  ${item.visibility || item.status}  ${item.title}`);
  console.log(`url: ${item.url}`);
  console.log(`id:  ${item.id}`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function deploy(flags, positionals) {
  const fromStdin = flags.stdin === true;
  const filename = fromStdin ? flags.filename : (flags.filename || path.basename(positionals[0] || ''));
  const content = fromStdin
    ? await readStdin()
    : await fs.readFile(positionals[0], 'utf8');
  const slug = flags.site || flags.code;

  const payload = await request('POST', '/api/v1/publish', {
    content,
    filename,
    slug,
    title: flags.title,
    description: flags.description,
    message: flags.message,
    visibility: flags.visibility,
  }, flags);
  const data = unwrap(payload);
  if (flags.json) printJson(payload);
  else console.log(data.url || payload.url);
}

async function list(flags) {
  const params = new URLSearchParams();
  if (flags.visibility) params.set('visibility', flags.visibility);
  if (flags.q) params.set('q', flags.q);
  const payload = await request('GET', `/api/v1/sites?${params.toString()}`, undefined, flags);
  const data = unwrap(payload);
  if (flags.json) {
    printJson(payload);
    return;
  }

  for (const item of data.items) {
    console.log(`${item.slug.padEnd(18)} ${item.visibility.padEnd(8)} ${String(item.viewCount).padStart(6)} views  ${item.title}`);
  }
  console.log(`\n${data.total} site(s)`);
}

async function get(flags, positionals) {
  const data = await resolveDeployment(positionals[0]);
  if (flags.json) printJson({ success: true, data });
  else printDeployment(data);
}

async function content(flags, positionals) {
  const payload = await request('GET', `/api/deploy/content?code=${encodeURIComponent(positionals[0])}`, undefined, flags);
  const data = unwrap(payload);
  if (flags.output) {
    await fs.writeFile(flags.output, data.content, 'utf8');
    if (!flags.json) console.log(`Wrote ${flags.output}`);
  }
  if (flags.json) printJson(payload);
  else console.log(data.content);
}

async function update(flags, positionals) {
  const file = positionals[1];
  const contentValue = await fs.readFile(file, 'utf8');
  const payload = await request('POST', '/api/v1/publish', {
    slug: positionals[0],
    content: contentValue,
    filename: flags.filename || path.basename(file),
    title: flags.title,
    description: flags.description,
    message: flags.message,
  }, flags);
  const data = unwrap(payload);
  if (flags.json) printJson(payload);
  else console.log(data.url || payload.url);
}

async function setVisibility(flags, positionals) {
  const site = await resolveDeployment(positionals[0]);
  const visibility = positionals[1] || flags.visibility;
  const payload = await request('PATCH', `/api/v1/sites/${site.id}`, { visibility }, flags);
  const data = unwrap(payload);
  if (flags.json) printJson(payload);
  else printDeployment(data);
}

async function versions(flags, positionals) {
  const site = await resolveDeployment(positionals[0]);
  const payload = await request('GET', `/api/v1/sites/${site.id}/versions`, undefined, flags);
  const data = unwrap(payload);
  if (flags.json) {
    printJson(payload);
    return;
  }

  for (const item of data.items) {
    console.log(`v${String(item.versionNumber).padEnd(4)} ${String(item.fileSize).padStart(8)}b  ${item.message || item.title}`);
    console.log(`       ${item.url}`);
  }
}

async function rollback(flags, positionals) {
  const site = await resolveDeployment(positionals[0]);
  const version = flags.to || positionals[1];
  const payload = await request('POST', `/api/v1/sites/${site.id}/rollback`, { version }, flags);
  if (flags.json) printJson(payload);
  else console.log(`Rolled back ${site.slug} to v${version}`);
}

async function remove(flags, positionals) {
  if (!flags.yes && !flags.json) {
    console.error('Refusing to delete without --yes.');
    process.exit(1);
  }
  const deployment = await resolveDeployment(positionals[0]);
  const payload = await request('DELETE', `/api/v1/sites/${deployment.id}`, undefined, flags);
  if (flags.json) printJson(payload);
  else console.log(`Deleted ${deployment.slug || deployment.code}`);
}

async function openDeployment(positionals) {
  const deployment = await resolveDeployment(positionals[0]);
  const command = process.platform === 'win32'
    ? 'cmd'
    : process.platform === 'darwin'
      ? 'open'
      : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', deployment.url] : [deployment.url];
  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
  console.log(deployment.url);
}

async function site(command, flags, positionals) {
  if (!command || command === 'list') {
    await list(flags);
    return;
  }

  if (command === 'info') {
    await get(flags, positionals);
    return;
  }

  if (command === 'visibility' || command === 'set-visibility') {
    await setVisibility(flags, positionals);
    return;
  }

  throw new Error(`Unknown site command: ${command}`);
}

async function agent(command, flags, positionals) {
  if (command === 'create') {
    const payload = await request('POST', '/api/v1/agent-keys', { name: positionals[0] }, flags);
    const data = unwrap(payload);
    if (flags.json) printJson(payload);
    else {
      console.log(`Created ${data.name}`);
      console.log(data.token);
    }
    return;
  }

  if (!command || command === 'list') {
    const payload = await request('GET', '/api/v1/agent-keys', undefined, flags);
    const data = unwrap(payload);
    if (flags.json) {
      printJson(payload);
      return;
    }
    for (const item of data) {
      console.log(`${item.id}  ${item.isActive ? 'active' : 'revoked'}  ${item.keyPrefix}  ${item.name}`);
    }
    return;
  }

  if (command === 'revoke') {
    const payload = await request('DELETE', `/api/v1/agent-keys/${encodeURIComponent(positionals[0])}`, undefined, flags);
    if (flags.json) printJson(payload);
    else console.log(`Revoked ${positionals[0]}`);
    return;
  }

  throw new Error(`Unknown agent command: ${command}`);
}

async function auth(command, flags) {
  if (command === 'login') {
    if (!flags.token) throw new Error('Missing --token.');
    await writeConfig({
      endpoint: flags.endpoint || DEFAULT_ENDPOINT,
      token: flags.token,
    });
    console.log('Logged in.');
    return;
  }

  if (command === 'status') {
    const runtime = await getRuntime();
    const data = {
      endpoint: runtime.endpoint,
      hasToken: Boolean(runtime.token),
      configFile: CONFIG_FILE,
    };
    if (flags.json) printJson({ success: true, data });
    else console.log(`${data.endpoint}\ntoken: ${data.hasToken ? 'set' : 'missing'}`);
    return;
  }

  if (command === 'logout') {
    await writeConfig({});
    console.log('Logged out.');
    return;
  }

  throw new Error(`Unknown auth command: ${command || ''}`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const command = argv[0];
  const { flags, positionals } = parseArgs(argv.slice(1));

  switch (command) {
    case 'auth':
      await auth(positionals[0], flags);
      break;
    case 'deploy':
      await deploy(flags, positionals);
      break;
    case 'list':
      await list(flags);
      break;
    case 'site':
      await site(positionals[0], flags, positionals.slice(1));
      break;
    case 'get':
      await get(flags, positionals);
      break;
    case 'content':
      await content(flags, positionals);
      break;
    case 'update':
      await update(flags, positionals);
      break;
    case 'versions':
      await versions(flags, positionals);
      break;
    case 'rollback':
      await rollback(flags, positionals);
      break;
    case 'agent':
      await agent(positionals[0], flags, positionals.slice(1));
      break;
    case 'delete':
      await remove(flags, positionals);
      break;
    case 'open':
      await openDeployment(positionals);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
