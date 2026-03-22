import Link from 'next/link';
import agentDocs from '@/content/agent-docs.json';

export default function ApiDocsPage() {
  const sampleRequest = `curl -X POST https://www.htmlcode.fun/api/deploy \\
  -H "Content-Type: application/json" \\
  -d '{
    "filename": "index.html",
    "title": "my-agent-page",
    "content": "<!doctype html><html><body><h1>Hello Agent</h1></body></html>"
  }'`;

  const sampleCustomCodeRequest = `curl -X POST https://www.htmlcode.fun/api/deploy \\
  -H "Content-Type: application/json" \\
  -d '{
    "filename": "landing.html",
    "title": "my-landing",
    "content": "<!doctype html><html><body><h1>Landing</h1></body></html>",
    "enableCustomCode": true,
    "customCode": "my-site-01"
  }'`;

  const sampleReadRequest = `curl "https://www.htmlcode.fun/api/deploy/content?code=my-site-01"`;
  const sampleDownloadRequest = `curl -L "https://www.htmlcode.fun/api/deploy/content?code=my-site-01&download=1" -o page.html`;
  const sampleUpdateRequest = `curl -X PATCH https://www.htmlcode.fun/api/deploy/content \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "my-site-01",
    "content": "<!doctype html><html><body><h1>Updated</h1></body></html>",
    "title": "my-landing-v2",
    "filename": "landing-v2.html"
  }'`;

  const sampleSuccess = `{
  "success": true,
  "id": "uuid",
  "code": "abc123",
  "url": "https://www.htmlcode.fun/s/abc123",
  "qrCode": "https://.../qrcodes/abc123.png",
  "requestId": "uuid",
  "cooldownSeconds": 10,
  "nextAvailableAt": "2026-03-16T12:00:10.000Z"
}`;

  const sampleCooldown = `{
  "success": false,
  "error": "当前处于部署冷却期，请稍后再试。",
  "errorCode": "COOLDOWN_ACTIVE",
  "detail": "部署成功后需等待 10 秒。",
  "stage": "rate_limit",
  "requestId": "uuid",
  "retryAfterSeconds": 7
}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">API 部署快速文档</h1>
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          返回首页
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">接口说明</h2>
        <p className="text-sm text-gray-700">部署入口：POST /api/deploy</p>
        <p className="text-sm text-gray-700">内容协作：GET /api/deploy/content、PATCH /api/deploy/content</p>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          {agentDocs.apiRules.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">请求示例</h2>
        <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{sampleRequest}</pre>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">自定义短链部署示例（默认关闭）</h2>
        <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{sampleCustomCodeRequest}</pre>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">读取 HTML 内容</h2>
          <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{sampleReadRequest}</pre>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">下载 HTML 文件</h2>
          <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{sampleDownloadRequest}</pre>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">更新 HTML 内容</h2>
          <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{sampleUpdateRequest}</pre>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">成功响应示例</h2>
          <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{sampleSuccess}</pre>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">冷却响应示例</h2>
          <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">{sampleCooldown}</pre>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-amber-900">常见错误调用（不要这样用）</p>
          <pre className="overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">curl -L -X POST https://www.htmlcode.fun/api/deploy -F "file=@index.html"</pre>
          <p className="text-sm text-amber-800">
            {agentDocs.commonErrorTip}
          </p>
        </div>
      </div>
    </div>
  );
}
