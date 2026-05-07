import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docsPath = path.join(root, 'src', 'content', 'agent-docs.json');
const outputPath = path.join(root, 'public', 'llms.txt');

const docs = JSON.parse(fs.readFileSync(docsPath, 'utf8'));

const lines = [
  '# htmlcode.fun Agent Deployment Guide',
  '',
  'Preferred API endpoint:',
  '- POST https://www.htmlcode.fun/api/deploy',
  '',
  'Machine-readable OpenAPI:',
  '- https://www.htmlcode.fun/openapi.json',
  '',
  'Required request format:',
  '- Content-Type: application/json',
  '- Body must be a single JSON object, not an array',
  '- Required fields:',
  '  - filename: string, must end with .html or .htm',
  '  - content: string, full HTML source',
  '- Agent default field:',
  '  - description: string, one short sentence describing what the HTML page is (max 240 chars)',
  '- Optional fields:',
  '  - title: string',
  '  - enableCustomCode: boolean (default false)',
  '  - customCode: string (required only when enableCustomCode=true)',
  '',
  'Custom short code rules:',
  '- customCode supports lowercase letters, numbers, hyphen',
  '- length 4-32',
  '- cannot start or end with hyphen',
  '- duplicate customCode returns 409 CUSTOM_CODE_TAKEN',
  '',
  'Do NOT use:',
  '- multipart/form-data',
  '- curl -F file@...',
  '- batch array payloads',
  '',
  'Rate limit:',
  '- After each successful deploy, global cooldown is 10 seconds',
'- During cooldown API returns 429 with retryAfterSeconds',
'- 429 responses also include the standard Retry-After header',
  '',
  'Collaboration APIs (known code/url):',
  '- GET https://www.htmlcode.fun/api/deploy/content?code=abc123',
  '- GET https://www.htmlcode.fun/api/deploy/content?url=https://www.htmlcode.fun/s/abc123',
  '- Download mode: add query download=1',
  '- PATCH https://www.htmlcode.fun/api/deploy/content',
  '  - JSON body requires: code or url, and content',
  '  - Optional: title, description, filename',
  '',
  'Success response includes:',
  '- success, id, code, url, qrCode, requestId, cooldownSeconds, nextAvailableAt, customCodeEnabled',
  '',
  'Error response includes:',
'- success=false, errorCode, error, detail, hint, docs, stage, requestId, retryAfterSeconds',
  '',
  'Docs:',
  '- https://www.htmlcode.fun/api-docs',
  '',
  'Homepage highlights:',
  ...docs.homepageHighlights.map((item) => `- ${item}`),
];

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log('Synced public/llms.txt from src/content/agent-docs.json');
