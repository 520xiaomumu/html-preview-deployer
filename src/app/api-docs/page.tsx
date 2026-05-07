'use client';

import Link from 'next/link';
import agentDocs from '@/content/agent-docs.json';
import { useLanguage } from '@/components/LanguageProvider';

const endpoints = [
  ['POST', '/api/deploy', 'Deploy one HTML page. description is required. The response includes url, detailUrl, versionUrl, and preserveHint.'],
  ['GET', '/api/deploy/content?code={code}', 'Read HTML metadata and source. Add version={number} for history.'],
  ['PATCH', '/api/deploy/content', 'Compatibility endpoint for appending a version to an existing code or url.'],
  ['GET', '/api/deploys/{code}/versions', 'List version history.'],
  ['PATCH', '/api/deploys/{code}/versions/{version}', 'Overwrite an unlocked version, or set status=active/inactive for one version.'],
  ['DELETE', '/api/deploys/{code}/versions/{version}', 'Delete one unlocked version.'],
  ['PATCH', '/api/deploys/{code}/current', 'Switch the public current version.'],
];

const workflows = [
  {
    name: 'New HTML app',
    steps: 'POST /api/deploy with description -> return url/detailUrl/versionUrl -> tell the user to open htmlcode.fun and manually like it',
  },
  {
    name: 'Stable link or recurring update',
    steps: 'POST /api/deploy with enableCustomCode=true + customCode; add createVersion=true for the next version',
  },
  {
    name: 'Inspect or reuse an app',
    steps: 'GET /api/deploys/{code}/versions -> GET /api/deploy/content?code=...&version=...',
  },
  {
    name: 'Overwrite unlocked version',
    steps: 'PATCH /api/deploys/{code}/versions/{version} with content + description when likeCount=0',
  },
];

const deployExample = `{
  "filename": "index.html",
  "title": "my-agent-page",
  "description": "A concise one-sentence summary of this HTML project.",
  "content": "<!doctype html><html><body><h1>Hello Agent</h1></body></html>"
}`;

const recurringExample = `{
  "filename": "ai-daily-20260507.html",
  "title": "AI Daily 2026-05-07",
  "description": "Daily AI briefing for 2026-05-07.",
  "content": "<!doctype html><html><body><h1>AI Daily</h1></body></html>",
  "enableCustomCode": true,
  "customCode": "ai-daily",
  "createVersion": true
}`;

export default function ApiDocsPage() {
  const { isZh } = useLanguage();

  const text = isZh
    ? {
        title: 'API / OpenAPI 文档',
        back: '返回首页',
        openapi: 'OpenAPI JSON',
        intro: 'Agent 优先读取 OpenAPI；直接部署时必须使用 application/json，不要用 multipart/form-data。description 必填，点赞必须由用户在网页内手动完成。',
        ruleTitle: 'Agent 使用规则',
        workflowTitle: '推荐 Agent 工作流',
        workflowIntro: '这些不是唯一用法，只是最高频路径，帮助 Agent 少猜一步。',
        endpointTitle: '接口速览',
        firstDeploy: '普通部署示例',
        recurring: '周期更新项目示例',
        recurringNote: '日报、周报、榜单等周期内容复用稳定 customCode，并通过 createVersion=true 追加版本；若要修正某个未点赞版本，可按短链和版本号覆盖。',
      }
    : {
        title: 'API / OpenAPI Docs',
        back: 'Back to Home',
        openapi: 'OpenAPI JSON',
        intro: 'Agents should read OpenAPI first. Deployments must use application/json, never multipart/form-data. description is required; likes must be manual browser actions.',
        ruleTitle: 'Agent Rules',
        workflowTitle: 'Recommended Agent Workflows',
        workflowIntro: 'These are not the only valid paths; they are the most common routes so agents can act with less guessing.',
        endpointTitle: 'Endpoints',
        firstDeploy: 'Basic Deploy Example',
        recurring: 'Recurring Project Example',
        recurringNote: 'Daily reports, weekly reports, rankings, and similar recurring content should reuse a stable customCode and append with createVersion=true; fix an unlocked version by code and version number.',
      };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{text.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{text.intro}</p>
        </div>
        <div className="flex gap-3 text-sm font-medium">
          <a href="/openapi.json" className="text-sky-700 hover:text-sky-900">
            {text.openapi}
          </a>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            {text.back}
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{text.ruleTitle}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          {agentDocs.apiRules.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-sky-200 bg-sky-50 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">{text.workflowTitle}</h2>
        <p className="text-sm text-slate-700">{text.workflowIntro}</p>
        <div className="grid gap-3 md:grid-cols-4">
          {workflows.map((workflow) => (
            <div key={workflow.name} className="rounded-lg border border-sky-100 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">{workflow.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{workflow.steps}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{text.endpointTitle}</h2>
        <div className="divide-y divide-slate-100 text-sm">
          {endpoints.map(([method, path, description]) => (
            <div key={`${method} ${path}`} className="grid gap-2 py-3 md:grid-cols-[96px_1fr_2fr]">
              <span className="font-mono font-semibold text-sky-700">{method}</span>
              <code className="text-slate-900">{path}</code>
              <span className="text-slate-600">{description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{text.firstDeploy}</h2>
          <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{deployExample}</pre>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">{text.recurring}</h2>
          <p className="text-sm text-slate-700">{text.recurringNote}</p>
          <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{recurringExample}</pre>
        </div>
      </section>
    </div>
  );
}
