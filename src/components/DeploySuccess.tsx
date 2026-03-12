'use client';

import React from 'react';
import { ExternalLink, Copy, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface DeploySuccessProps {
  url: string;
  qrCode: string;
  code: string;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DeploySuccess({ url, qrCode, code, onNotify }: DeploySuccessProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    onNotify?.('链接已复制到剪贴板', 'success');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8 text-center animate-fade-in">
      <div className="flex justify-center mb-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">部署成功！</h2>
      <p className="text-gray-500 mb-8">您的 HTML 页面已上线，可以通过以下方式访问。</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">访问链接</h3>
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            />
            <button
              onClick={handleCopy}
              className="inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="复制链接"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            立即访问
          </a>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">二维码</h3>
          <div className="bg-white p-2 rounded shadow-sm">
            <img src={qrCode} alt="Deployment QR Code" className="w-32 h-32" />
          </div>
          <a
            href={qrCode}
            download={`qrcode-${code}.png`}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            下载二维码
          </a>
        </div>
      </div>

      <div className="mt-8">
        <Link
          href="/deploy"
          className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          查看部署历史
        </Link>
      </div>
    </div>
  );
}
