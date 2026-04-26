'use client';

import React, { useMemo, useState } from 'react';
import FileUpload from '@/components/FileUpload';
import Preview from '@/components/Preview';
import DeploySuccess from '@/components/DeploySuccess';
import Toast from '@/components/Toast';
import { Rocket, Loader2 } from 'lucide-react';
import agentDocs from '@/content/agent-docs.json';
import { useLanguage } from '@/components/LanguageProvider';

type InputMode = 'upload' | 'editor';

interface DeployResult {
  id: string;
  code: string;
  url: string;
  qrCode: string;
}

const DEFAULT_FILENAME = 'index.html';

export default function DeployPage() {
  const { language, isZh } = useLanguage();

  const text = useMemo(
    () =>
      isZh
        ? {
            emptyContent: '请先上传或输入 HTML 内容',
            deployFailedPrefix: '部署失败',
            deployError: '部署过程中发生错误',
            pageTitle: '手动部署',
            pageDesc: `直接上传 HTML 或粘贴代码后即可部署。${agentDocs.deployEndpoint}`,
            doneTitle: '部署完成',
            deployAnother: '部署另一个文件',
            previewComingTitle: '实时预览将在这里显示',
            previewComingDesc: '上传 HTML 文件或粘贴代码后，预览会即时更新，确认无误再一键上线。',
            uploadTab: '上传文件',
            editorTab: '粘贴代码',
            filenameLabel: '部署文件名',
            filenameTip: '未填写 .html 后缀时，系统会自动补全。',
            contentLoadedTip: '内容已载入，可切换到“粘贴代码”继续微调。',
            htmlCode: 'HTML 代码',
            infoTitle: '内容信息',
            source: '来源',
            sourceUpload: '上传文件',
            sourceManual: '手动输入',
            fileName: '文件名',
            fileSize: '大小',
            status: '状态',
            statusReady: '可预览 / 可部署',
            statusWaiting: '等待输入内容',
            deploying: '部署中...',
            deployNow: '立即部署',
            clear: '清空内容',
          }
        : {
            emptyContent: 'Please upload or paste HTML content first',
            deployFailedPrefix: 'Deployment failed',
            deployError: 'An error occurred during deployment',
            pageTitle: 'Manual Deploy',
            pageDesc: `Upload HTML or paste code to deploy instantly. ${agentDocs.deployEndpoint}`,
            doneTitle: 'Deployment Complete',
            deployAnother: 'Deploy another file',
            previewComingTitle: 'Live preview will appear here',
            previewComingDesc: 'Upload an HTML file or paste code to see real-time preview before deploying.',
            uploadTab: 'Upload File',
            editorTab: 'Paste Code',
            filenameLabel: 'Deployment filename',
            filenameTip: 'If no .html suffix is provided, it will be appended automatically.',
            contentLoadedTip: 'Content loaded. You can switch to "Paste Code" for quick edits.',
            htmlCode: 'HTML code',
            infoTitle: 'Content Info',
            source: 'Source',
            sourceUpload: 'Uploaded file',
            sourceManual: 'Manual input',
            fileName: 'Filename',
            fileSize: 'Size',
            status: 'Status',
            statusReady: 'Ready to preview and deploy',
            statusWaiting: 'Waiting for content',
            deploying: 'Deploying...',
            deployNow: 'Deploy Now',
            clear: 'Clear Content',
          },
    [isZh],
  );

  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState(DEFAULT_FILENAME);
  const [content, setContent] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, type });
  };

  const hasContent = content.trim().length > 0;
  const normalizedFilename = filename.trim() || DEFAULT_FILENAME;
  const deployFilename = /\.html?$/i.test(normalizedFilename) ? normalizedFilename : `${normalizedFilename}.html`;
  const displaySize = file ? file.size : new Blob([content]).size;

  const handleFileSelect = (selectedFile: File, fileContent: string) => {
    setInputMode('upload');
    setFile(selectedFile);
    setFilename(selectedFile.name);
    setContent(fileContent);
    setDeployResult(null);
  };

  const handleModeChange = (mode: InputMode) => {
    setInputMode(mode);
    setDeployResult(null);

    if (mode === 'editor' && !filename.trim()) {
      setFilename(DEFAULT_FILENAME);
    }
  };

  const handleContentChange = (nextContent: string) => {
    setFile(null);
    setContent(nextContent);
    setDeployResult(null);
  };

  const handleReset = () => {
    setInputMode('upload');
    setFile(null);
    setFilename(DEFAULT_FILENAME);
    setContent('');
    setDeployResult(null);
  };

  const handleDeploy = async () => {
    if (!hasContent) {
      showToast(text.emptyContent, 'error');
      return;
    }

    setIsDeploying(true);
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          filename: deployFilename,
          title: deployFilename.replace(/\.html?$/i, ''),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDeployResult(data);
      } else {
        showToast(`${text.deployFailedPrefix}: ${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Deploy error:', error);
      showToast(text.deployError, 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <Toast
        isOpen={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
      />

      <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{text.pageTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {text.pageDesc}
        </p>
      </div>

      {deployResult ? (
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{text.doneTitle}</h3>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {text.deployAnother}
            </button>
          </div>
          <DeploySuccess
            url={deployResult.url}
            qrCode={deployResult.qrCode}
            code={deployResult.code}
            onNotify={showToast}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            {hasContent ? (
              <Preview content={content} />
            ) : (
              <div className="flex h-[600px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <div className="max-w-md space-y-3">
                  <h3 className="text-2xl font-semibold text-slate-900">{text.previewComingTitle}</h3>
                  <p className="text-slate-500">{text.previewComingDesc}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex w-full rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handleModeChange('upload')}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    inputMode === 'upload' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {text.uploadTab}
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('editor')}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    inputMode === 'editor' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {text.editorTab}
                </button>
              </div>

              <div className="space-y-2">
                <label htmlFor="filename" className="block text-sm font-medium text-slate-700">
                  {text.filenameLabel}
                </label>
                <input
                  id="filename"
                  type="text"
                  value={filename}
                  onChange={(e) => {
                    setFilename(e.target.value);
                    setDeployResult(null);
                  }}
                  placeholder={DEFAULT_FILENAME}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-sky-300 transition focus:border-sky-400 focus:ring-2"
                />
                <p className="text-xs text-slate-500">{text.filenameTip}</p>
              </div>

              {inputMode === 'upload' ? (
                <div className="space-y-3">
                  <FileUpload onFileSelect={handleFileSelect} />
                  {hasContent && <p className="text-sm text-slate-500">{text.contentLoadedTip}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="html-editor" className="block text-sm font-medium text-slate-700">
                    {text.htmlCode}
                  </label>
                  <textarea
                    id="html-editor"
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder={
                      language === 'zh'
                        ? '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <title>我的页面</title>\n  </head>\n  <body>\n    <h1>Hello htmlcode.fun</h1>\n  </body>\n</html>'
                        : '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <title>My Page</title>\n  </head>\n  <body>\n    <h1>Hello htmlcode.fun</h1>\n  </body>\n</html>'
                    }
                    className="min-h-[320px] w-full rounded-lg border border-slate-300 px-3 py-3 text-sm text-slate-900 outline-none ring-sky-300 transition focus:border-sky-400 focus:ring-2"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">{text.infoTitle}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{text.source}</span>
                  <span className="font-medium text-slate-900">{file ? text.sourceUpload : text.sourceManual}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{text.fileName}</span>
                  <span className="max-w-[200px] truncate font-medium text-slate-900" title={deployFilename}>
                    {deployFilename}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{text.fileSize}</span>
                  <span className="font-medium text-slate-900">{(displaySize / 1024).toFixed(2)} KB</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{text.status}</span>
                  <span className="font-medium text-slate-900">{hasContent ? text.statusReady : text.statusWaiting}</span>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying || !hasContent}
                  className="flex w-full items-center justify-center rounded-lg border border-transparent bg-sky-600 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="-ml-1 mr-2 h-5 w-5 animate-spin" />
                      {text.deploying}
                    </>
                  ) : (
                    <>
                      <Rocket className="-ml-1 mr-2 h-5 w-5" />
                      {text.deployNow}
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {text.clear}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
