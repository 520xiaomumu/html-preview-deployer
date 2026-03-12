'use client';

import React, { useRef, useEffect, useState } from 'react';
import { RefreshCw, Monitor, Tablet, Smartphone } from 'lucide-react';

interface PreviewProps {
  content?: string;
  url?: string;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

export default function Preview({ content, url }: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DeviceType>('desktop');

  useEffect(() => {
    if (iframeRef.current) {
      if (url) {
        iframeRef.current.src = url;
        iframeRef.current.removeAttribute('srcdoc');
      } else if (content) {
        iframeRef.current.srcdoc = content;
        iframeRef.current.removeAttribute('src');
      } else {
        iframeRef.current.removeAttribute('src');
        iframeRef.current.removeAttribute('srcdoc');
      }
    }
  }, [content, url]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      if (url) {
        iframeRef.current.src = url;
      } else if (content) {
        iframeRef.current.srcdoc = content;
      }
    }
  };

  const getContainerWidth = () => {
    switch (device) {
      case 'mobile':
        return 'w-[375px]';
      case 'tablet':
        return 'w-[768px]';
      case 'desktop':
      default:
        return 'w-full';
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm bg-gray-100 flex flex-col h-[600px]">
      <div className="bg-white border-b px-4 py-2 flex justify-between items-center shrink-0">
        <h3 className="text-sm font-medium text-gray-700">实时预览</h3>
        
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-md">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded-md transition-all ${
              device === 'desktop' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="电脑端 (100%)"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={`p-1.5 rounded-md transition-all ${
              device === 'tablet' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="平板端 (768px)"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded-md transition-all ${
              device === 'mobile' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="手机端 (375px)"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleRefresh}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          title="刷新预览"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      
      <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center">
        <div className={`${getContainerWidth()} h-full bg-white transition-all duration-300 shadow-lg`}>
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            title="HTML Preview"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      </div>
    </div>
  );
}
