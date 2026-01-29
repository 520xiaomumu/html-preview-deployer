'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import Preview from '@/components/Preview';
import DeploySuccess from '@/components/DeploySuccess';
import { Rocket, Loader2 } from 'lucide-react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<any>(null);

  const handleFileSelect = (selectedFile: File, fileContent: string) => {
    setFile(selectedFile);
    setContent(fileContent);
    setDeployResult(null); // Reset result on new file
  };

  const handleDeploy = async () => {
    if (!file || !content) return;

    setIsDeploying(true);
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          filename: file.name,
          title: file.name.replace(/\.html?$/i, ''),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDeployResult(data);
      } else {
        alert(`部署失败: ${data.error}`);
      }
    } catch (error) {
      console.error('Deploy error:', error);
      alert('部署过程中发生错误');
    } finally {
      setIsDeploying(false);
    }
  };

  if (deployResult) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">部署完成</h1>
          <button
            onClick={() => {
              setFile(null);
              setContent('');
              setDeployResult(null);
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            部署另一个文件
          </button>
        </div>
        <DeploySuccess
          url={deployResult.url}
          qrCode={deployResult.qrCode}
          code={deployResult.code}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
          HTML 预览 & 部署工具
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          上传您的 HTML 文件，即时预览效果，并一键部署到云端生成永久访问链接和二维码。
        </p>
      </div>

      {!file ? (
        <div className="max-w-xl mx-auto">
          <FileUpload onFileSelect={handleFileSelect} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Preview content={content} />
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">文件信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">文件名</span>
                  <span className="font-medium text-gray-900 truncate max-w-[200px]" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">大小</span>
                  <span className="font-medium text-gray-900">
                    {(file.size / 1024).toFixed(2)} KB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">类型</span>
                  <span className="font-medium text-gray-900">text/html</span>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying}
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
                  onClick={() => {
                    setFile(null);
                    setContent('');
                  }}
                  className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  重新上传
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
