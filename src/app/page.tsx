'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import Preview from '@/components/Preview';
import DeploySuccess from '@/components/DeploySuccess';
import Toast from '@/components/Toast';
import { Rocket, Loader2 } from 'lucide-react';
import agentDocs from '@/content/agent-docs.json';

type InputMode = 'upload' | 'editor';

interface DeployResult {
  id: string;
  code: string;
  url: string;
  qrCode: string;
}

const DEFAULT_FILENAME = 'index.html';

export default function Home() {
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
  const deployFilename = /\.html?$/i.test(normalizedFilename)
    ? normalizedFilename
    : `${normalizedFilename}.html`;
  const displaySize = file ? file.size : new Blob([content]).size;

  const handleFileSelect = (selectedFile: File, fileContent: string) => {
    setInputMode('upload');
    setFile(selectedFile);
    setFilename(selectedFile.name);
    setContent(fileContent);
    setDeployResult(null); // Reset result on new file
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
      showToast('请先上传或输入 HTML 内容', 'error');
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
        showToast(`部署失败: ${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Deploy error:', error);
      showToast('部署过程中发生错误', 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  if (deployResult) {
    return (
      <div className="space-y-8">
        <Toast
          isOpen={toast.open}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((current) => ({ ...current, open: false }))}
        />
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">部署完成</h1>
          <button
            onClick={handleReset}
            className="text-blue-600 hover:text-blue-800"
          >
            部署另一个文件
          </button>
        </div>
        <DeploySuccess
          url={deployResult.url}
          qrCode={deployResult.qrCode}
          code={deployResult.code}
          onNotify={showToast}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Toast
        isOpen={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
      />
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
          HTML 预览 & 部署工具
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          上传您的 HTML 文件，即时预览效果，并一键部署到云端生成永久访问链接和二维码。
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-blue-900">Agent API 部署通道已开放</h2>
            <p className="text-sm text-blue-800">
              首选调用方式：<span className="font-semibold">{agentDocs.deployEndpoint}</span>。可直接写入 HTML 代码进行部署，成功后返回上线链接。
            </p>
            <ul className="list-disc pl-5 text-sm text-blue-800 space-y-1">
              {agentDocs.homepageHighlights.map((item) => (
                <li key={item}>
                  {item.includes('不要使用') ? <span className="font-semibold">{item}</span> : item}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href="/api-docs"
            className="inline-flex items-center justify-center rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            查看 API 快速文档
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {hasContent ? (
            <Preview content={content} />
          ) : (
            <div className="border rounded-lg shadow-sm bg-white h-[600px] flex items-center justify-center p-8 text-center">
              <div className="max-w-md space-y-3">
                <h2 className="text-2xl font-semibold text-gray-900">实时预览将在这里显示</h2>
                <p className="text-gray-500">
                  你可以上传 HTML 文件，也可以直接粘贴或编写 HTML 代码，预览会随着内容变化即时更新。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-5">
            <div className="inline-flex rounded-lg bg-gray-100 p-1 w-full">
              <button
                type="button"
                onClick={() => handleModeChange('upload')}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  inputMode === 'upload'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                上传文件
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('editor')}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  inputMode === 'editor'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                粘贴 / 编写代码
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="filename" className="block text-sm font-medium text-gray-700">
                部署文件名
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                未填写 .html 后缀时，系统会自动补全为 HTML 文件名。
              </p>
            </div>

            {inputMode === 'upload' ? (
              <div className="space-y-3">
                <FileUpload onFileSelect={handleFileSelect} />
                {hasContent && (
                  <p className="text-sm text-gray-500">
                    当前内容已载入。切换到“粘贴 / 编写代码”后，可以继续微调 HTML。
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="html-editor" className="block text-sm font-medium text-gray-700">
                  HTML 代码
                </label>
                <textarea
                  id="html-editor"
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder={'<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <title>My Page</title>\n  </head>\n  <body>\n    <h1>Hello HTML</h1>\n  </body>\n</html>'}
                  className="min-h-[360px] w-full rounded-md border border-gray-300 px-3 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-500">
                  支持直接粘贴整段 HTML，也支持在这里从零开始编写页面。
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">内容信息</h3>
            <div className="space-y-3">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">来源</span>
                <span className="font-medium text-gray-900">{file ? '上传文件' : '手动输入'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">文件名</span>
                <span className="font-medium text-gray-900 truncate max-w-[200px]" title={deployFilename}>
                  {deployFilename}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">大小</span>
                <span className="font-medium text-gray-900">{(displaySize / 1024).toFixed(2)} KB</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">状态</span>
                <span className="font-medium text-gray-900">{hasContent ? '可预览 / 可部署' : '等待输入内容'}</span>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <button
                onClick={handleDeploy}
                disabled={isDeploying || !hasContent}
                className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    部署中...
                  </>
                ) : (
                  <>
                    <Rocket className="-ml-1 mr-2 h-5 w-5" />
                    立即部署
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                清空内容
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
