'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileCode } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File, content: string) => void;
}

export default function FileUpload({ onFileSelect }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = useCallback((file: File) => {
    if (file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileSelect(file, content);
      };
      reader.readAsText(file);
    } else {
      alert('Please upload an HTML file');
    }
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
      `}
    >
      <input
        type="file"
        accept=".html,.htm"
        className="hidden"
        id="file-upload"
        onChange={handleFileInput}
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
        <Upload className={`w-12 h-12 mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-lg font-medium text-gray-700">
          点击或拖拽上传 HTML 文件
        </p>
        <p className="text-sm text-gray-500 mt-2">
          支持 .html, .htm 格式
        </p>
      </label>
    </div>
  );
}
